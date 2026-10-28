# Relatório — Write-back CGStock → Informakon (branch feature/informakon-writeback)

Data: 28/10/2026 · Base: `dbTREINO_MGA` + `dbTREINO_CV` (usuário `apidevin` leitura+escrita)

## 1. Como o Informakon grava (descoberto por análise do banco)

| Aspecto | Achado | Consequência |
|---|---|---|
| Numeração | `spGeraSequencia(@Seq_NomeTabela, @Seq_Numero OUT)` sobre tabela `Sequenciais` (UPDLOCK/HOLDLOCK). `MATERIAISENTRADA`/`MATERIAISSAIDA`/`INSUMOS` = MAX real das tabelas | Reusamos a proc oficial dentro da nossa transação |
| Estoque | Triggers `tiud_MateriaisEntrada_Itens`/`tiud_MateriaisSaida_Itens` → `spAtualizaEstoqueDataRef` → atualiza `MateriaisEstoque` **e** `MateriaisEstoqueInsumos` | Só inserimos cabeçalho+itens; o ERP faz o resto |
| Valor do item | `EntradaItem_Valor` = **total da linha** (prova: qtd 3, valor 15,5 → `Estoque_Valor`=15,5; saída parcial rateia 50→25) | Ponte envia `unitCost × quantidade` |
| Insumo | `Insumo`+`InsumoSub(cod,0)`; trigger `tI_Insumo` valida FK (`Unidade`, `Caracterizacao_de_Insumos`) | Criação exige cla/gru/carIns válidos |
| Padrão SIMAT | Saída: MovTipo `S`, DocTipo `RM`, `Origem='SIMAT'` | Usamos `Origem='CGSTK'` + `Audit='CGSTOCK'` p/ rastreabilidade |

## 2. O que foi construído

**qweb-api** (`src/write/` + `src/routes/write.ts`):
- `POST /write/entrada`, `/write/saida` — transação única; valida centro (allowlist),
  insumos existentes, docNumero, saldo (saída bloqueia negativo); `?dry=1`.
- `POST /write/insumos`, `PUT /write/insumos/:cod` — cadastro e edição.
- `GET /write/opcoes` — unidades + caracterizações p/ formulários.
- `GET /write/log` + tabela `InfWrite`: auditoria + idempotência (`clienteRef`).
- Feature flag `WRITE_ENABLED` (default off); guards em todas as rotas.

**CGStock** (`src/lib/informakon.ts` + hooks):
- Recebimento (`/receipts/new`, confirmação de rascunho e sync offline) → entrada no ERP.
- Entrega rápida (online + offline) → saída RM no ERP.
- Edição de produto → atualiza `Insumo`/unidade no ERP.
- Itens sem `informakonKey` são omitidos com aviso; falha no ERP nunca desfaz a operação local (toast amarelo).

## 3. Testes executados e resultados

**Unitários (30 — todos passando)**
- `qweb-api`: 22 testes de `validacao.ts` (parse de centro, allowlist fail-closed,
  itens, docNumero, formatação char, novo insumo).
- `CGStock`: 8 testes dos parsers de `informakonKey` (INS/CC/UNI/CAT).

**Integração (SQL Server real — verificado nas tabelas)**
- Dry-run: válido ok; centro fora da allowlist, insumo inexistente e
  saldo negativo bloqueados com mensagem clara.
- Entrada `81115`: cabeçalho+item corretos, `MateriaisEstoque` atualizado
  pelo trigger (qtd 2, valor 50), flag `MateriaisEstoqueInsumos` criada.
- Idempotência: reenvio do mesmo `clienteRef` → mesmo número, sem duplicar.
- Saída `13348`: DocTipo RM, MovTipo S, Destinatario gravado; saldo 2→1 com
  valor rateado pelo ERP (50→25).
- Insumo `30350`: criado (`Insumo`+`InsumoSub`) e editado via PUT.
- **E2E pela camada HTTP do app**: `POST /api/sync/receipt` (sessão autenticada)
  → recebimento local + `informakon.numero=81116/81117` → verificado no SQL
  Server (itens, doc, origem CGSTK e `MateriaisEstoque` 3+4=7 un, valor 55,5).

## 4. Limitações conhecidas / próximos passos

- Criação de produto novo no ERP pela UI: rota pronta; falta campo de
  caracterização (cla/gru/carIns) no formulário — usar `/write/opcoes`.
- Saída via entrega rápida testada na camada de API; validar também o fluxo
  de tela com QR no roteiro de uso.
- `db_datawriter` não cobre `EXECUTE`: se futuros testes usarem procedures
  do ERP, rodar `GRANT EXECUTE ON SCHEMA::dbo TO apidevin`.
- Registros de teste criados: Entradas 81115–81117, Saída 13348, Insumo 30350
  (todos `Origem=CGSTK`/`Audit=CGSTOCK` — fáceis de localizar e estornar).
