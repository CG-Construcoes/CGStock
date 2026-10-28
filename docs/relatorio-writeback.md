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

**Uso real via navegador (Playwright + Chrome — tela a tela, como um almoxarife)**
- Login real → `/receipts/new`: fornecedor, Almoxarifado Central, NF-TESTE-UI-001,
  CHAPA DE POLIESTIRENO ×2 a R$12,50 → toast **"Informakon: entrada #81118"** →
  SQL Server confere item e saldo (9 un / 80,5 acumulado nos testes).
- Edição de produto em `/products/:id/edit` → nome com "(TESTE WB)" → `Insumo`
  **e** `InsumoSub` 30349 atualizados (`Audit=CGSTOCK`).
- Entrega rápida em `/quick-issue`: código `TESTEQR01` (funcionário de teste com
  acesso à obra Ousy) → produto `000100-000-CV` → toast **"Informakon: saída
  #294"** → `dbTREINO_CV` confere `MateriaisSaida` RM com **Destinatario
  "FUNCIONARIO TESTE QR"** e estoque 1→0 baixado pelo trigger.

### Ajustes finos após conferência visual no Informakon

- **`Entrada_Data`/`Saida_Data` sem hora**: o ERP grava sempre meia-noite local;
  hora na coluna fazia o grid exibir `28/10/2026 11:59`. Corrigido com
  `parseDataERP` (data-only → meia-noite local; datetime → truncado).
- **`Saida_DepositoNumero` = "Autorização Depósito"**: preenchido **somente em
  transferências** (MovTipo T) com o **próprio número da saída** — autoriza a
  entrada no depósito destino. Saídas de consumo (S) ficam NULL: correto manter.
- **`ImportadoArquivo='N'`**: linhas do ERP trazem 'N'; write-back agora também.
- **Destinatário no CGStock**: tela de detalhe da movimentação exibe
  "Destinatário" (funcionário que recebeu), espelhando o Informakon.

## 5. Registros de teste criados (Origem=CGSTK, Audit=CGSTOCK)

| Base | Registro | O que prova |
|---|---|---|
| MGA | Entradas 81115–81118 | escrita direta + E2E HTTP + E2E UI |
| MGA | Saída 13348 | guarda de saldo + rateio de valor |
| MGA | Insumo 30350 | criação/edição de produto via API |
| MGA | Insumo 30349 | edição via tela de produtos |
| CV  | Saída 294 | entrega rápida UI → saída RM na CV |

## 4. Limitações conhecidas / próximos passos

- Criação de produto novo no ERP pela UI: rota pronta; falta campo de
  caracterização (cla/gru/carIns) no formulário — usar `/write/opcoes`.
- `db_datawriter` não cobre `EXECUTE`: se futuros testes usarem procedures
  do ERP, rodar `GRANT EXECUTE ON SCHEMA::dbo TO apidevin`.
- Funcionário de teste criado: `TESTEQR01` (FUNCIONARIO TESTE QR, obra Ousy)
  — apenas no banco de teste.
