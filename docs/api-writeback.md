# qweb-api — Documentação das rotas de Write-back

Base URL: `http://<servidor>:3085` · Auth: header `X-Api-Key` · JSON
Feature flag: `WRITE_ENABLED=true` (off por padrão). `?dry=1` valida sem gravar.

Segurança embutida: escrita só em centros da `SYNC_ALMOX_INCLUDE`; saída bloqueia
saldo negativo (opt-out `permitirNegativo:true`); idempotência por `clienteRef`;
trilha completa em `InfWrite` (Postgres); `Audit_*_UserName='CGSTOCK'` no ERP.

## POST /write/entrada

Lança `MateriaisEntrada` + itens (numeração via `spGeraSequencia`; estoque
atualizado pelo trigger do ERP).

```json
{
  "src": "MGA",
  "centro": "CGC.01.0104",
  "docNumero": "NF-12345",          // obrigatório, máx 20
  "docTipo": "CGSTOCK",             // opcional, default env
  "data": "2026-10-28",             // opcional, default agora
  "clienteRef": "receipt-abc123",   // idempotência
  "itens": [
    {"insumoCod": 11933, "quantidade": 2, "valor": 50.00, "obs": "opcional"}
  ]
}
```
`itens[].valor` = **valor TOTAL da linha** (o ERP rateia total÷qtd no custo).

Resposta: `{"ok":true,"numero":81116,"centro":"CGC.01.0104","itens":1}`.
Reenvio com mesmo `clienteRef`: `{"ok":true,"idempotente":true,"numero":81116}`.

## POST /write/saida

Lança `MateriaisSaida` (DocTipo padrão `RM`, MovTipo `S`). Campos extras:
`destinatario` (varchar 255), `permitirNegativo` (bool).

## POST /write/insumos

Cria `Insumo` + `InsumoSub(0)` (sequência `INSUMOS`).

```json
{"src":"MGA","especificacao":"CIMENTO CP-II 50KG","unid":"SC",
 "claIns":"01","gruIns":"01","carIns":"001","clienteRef":"prod-42"}
```
Validações: `unid` existe em `Unidade`; `(claIns,gruIns,carIns)` existe em
`Caracterizacao_de_Insumos` (FK enforced pelo trigger `tI_Insumo`).

## PUT /write/insumos/:cod

`{"src":"MGA","especificacao":"novo texto","unid":"SC"}` — campos opcionais,
atualiza `Insumo` + `InsumoSub(0)` + `Audit_*`.

## GET /write/opcoes?src=MGA

`{"unidades":[{Unid_Cod,Unid_Titulo}],"caracterizacoes":[{ClaIns_Cod,ClaIns_Titulo,
GruIns_Cod,GruIns_Titulo,CarIns_Cod,CarIns_Titulo}]}` — para formulários.

## GET /write/log?limit=50

Últimas operações (ok/erro/dry) com payload, `erpNumero` e erro.

## Códigos de erro

| HTTP | Causa |
|------|-------|
| 400 | validação (centro, itens, docNumero, insumo inexistente, saldo) |
| 401 | `X-Api-Key` ausente/inválida |
| 403 | `WRITE_ENABLED=false` |
| 404 | insumo inexistente (PUT) |
| 500 | falha SQL/conexão — payload registrado em `InfWrite` com `error` |
