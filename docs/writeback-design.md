# Write-back CGStock → Informakon — desenho

## Como o Informakon grava movimentos (descoberto por análise do banco)

1. **Numeração**: `EXEC spGeraSequencia @Seq_NomeTabela, @Seq_Numero OUTPUT` —
   contador na tabela `Sequenciais` (UPDLOCK/HOLDLOCK dentro da proc).
   Nomes: `MATERIAISENTRADA`, `MATERIAISSAIDA`, `INSUMOS` (=MAX real, conferido).
2. **Estoque**: triggers `tiud_MateriaisEntrada_Itens` / `tiud_MateriaisSaida_Itens`
   chamam `spAtualizaEstoqueDataRef` → atualizam `MateriaisEstoque` +
   `MateriaisEstoqueInsumos` automaticamente. **Só inserimos cabeçalho + itens.**
3. **Insumo**: `Insumo` + `InsumoSub(cod, 0, especificacao)` — o trigger `tI_Insumo`
   é só validação FK (exige `Unidade` + `Caracterizacao_de_Insumos` válidos).
4. **Campos observados em linhas reais**: `MovTipo` E=I/C/O/T, S=S/I/O/V/N;
   `DocTipo` livre ('RM','NF-e','AE'...); `Dia`=dia do mês (char2);
   `Origem`='SIMAT'/'SISUP'; itens: `Item`='001'.., `Numero`=1..N, `SubInsumo_Cod`=0.

## Decisões

- Escrita direta (INSERT/UPDATE) em vez da proc de saída — controlamos Audit_*,
  Origem='CGSTK' e validações que a proc não faz.
- Tudo em transação única; `spGeraSequencia` dentro da tx (locks até o COMMIT).
- `WRITE_ENABLED=false` por padrão; `?dry=1` valida sem gravar.
- Só centros da `SYNC_ALMOX_INCLUDE` aceitam escrita.
- Saída bloqueia saldo negativo (opt-out via `permitirNegativo`).
- Idempotência: `clienteRef` único por operação (tabela `InfWrite` no Postgres).
- Audit trail: `Audit_Insert_UserName='CGSTOCK'` no ERP + log completo em `InfWrite`.
