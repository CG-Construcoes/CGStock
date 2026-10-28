# Roteiro de testes — Write-back CGStock → Informakon

Ordem: camada de rede → camada de aplicação → tela a tela (dia a dia).
Base: `dbTREINO_MGA` / `dbTREINO_CV`. Após cada passo, conferir no Informakon.

## 1. Camada de rede / API (curl)

```bash
# 1.1 API viva
curl -s http://localhost:3085/healthz            # esperado: {"ok":true,...}

# 1.2 Auth obrigatória
curl -s http://localhost:3085/write/log          # sem chave → 401

# 1.3 Dry-run válido (não grava nada)
curl -s -X POST "http://localhost:3085/write/entrada?dry=1" \
  -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"src":"MGA","centro":"CGC.01.0104","docNumero":"DRY-1",
       "itens":[{"insumoCod":11933,"quantidade":2,"valor":50}]}'
# esperado: {"dry":true,"ok":true,...}

# 1.4 Guards (todos devem falhar SEM gravar):
#   - centro fora da allowlist:  "centro":"CGC.01.0103"
#   - insumo inexistente:        "insumoCod":999999
#   - saída acima do saldo:      POST /write/saida com quantidade gigante
#   - docNumero vazio:           "docNumero":""
```

## 2. Camada de aplicação (integração direta)

```bash
# 2.1 Entrada real → anotar o número retornado
curl -s -X POST "http://localhost:3085/write/entrada" -H "X-Api-Key: $KEY" \
  -H "Content-Type: application/json" -d '{"src":"MGA","centro":"CGC.01.0104",
  "docNumero":"SEU-DOC-001","clienteRef":"ref-unica-001",
  "itens":[{"insumoCod":11933,"quantidade":2,"valor":50,"obs":"teste"}]}'
# → {"ok":true,"numero":NNNNN,...}

# 2.2 Idempotência: repetir MESMO clienteRef → mesmo numero, sem duplicar

# 2.3 Conferir no SQL Server / tela do Informakon:
#   MateriaisEntrada NNNNN (Origem=CGSTK, usr=CGSTOCK)
#   MateriaisEntrada_Itens + MateriaisEstoque atualizado (trigger do ERP)
#   Posição de Estoque do centro 01.0104 mostra o insumo

# 2.4 Saída real → mesmo roteiro com /write/saida (DocTipo RM)

# 2.5 Insumo: POST /write/insumos → anotar insumoCod → PUT /write/insumos/:cod
#   conferir cadastro no Informakon (especificação + unidade)
```

## 3. Dia a dia no sistema (tela a tela)

| # | Tela | Ação | Espera-se |
|---|------|------|-----------|
| 3.1 | `/login` | Entrar | Dashboard abre sem loop |
| 3.2 | `/receipts/new` | Nova Entrada no **Almoxarifado Central**, item com origem Informakon, COMPLETED | Toast: "…Informakon: entrada #N" |
| 3.3 | `/receipts` | Abrir o recebimento criado | Itens e totais corretos |
| 3.4 | `/stock` | Filtrar Almoxarifado Central | Item aparece com saldo |
| 3.5 | `/movements` | Verificar movimento ENTRY | Documento NF gravado |
| 3.6 | `/quick-issue` | Entrega rápida de item ERP | Toast "…Informakon: saída #N" |
| 3.7 | `/products/:id/edit` | Editar especificação de produto com `informakonKey` | Reflete no cadastro do Informakon |
| 3.8 | `/receipts/new` em almox. **local** (sem vínculo) | Entrada | Funciona normal, sem tentativa ERP |

## 4. Verificação final no Informakon (você)

- Posição de Estoque `CGC.01.0104`: quantidades batem com a tela `/stock`
- Entradas/Saídas aparecem com **Origem `CGSTK`** e usuário **`CGSTOCK`** (fácil de rastrear e de limpar)
- Documentos com `DocNumero` = número da NF / ENT-XXXXXX do CGStock
