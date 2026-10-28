# Mapeamento Informakon → CGStok

> Fase 2 — correspondência campo a campo, chaves de reconciliação e estratégia de
> sincronização. Fonte da verdade: **Informakon** (`dbTREINO_CV`/`dbCONV`).
> Sync unidirecional. Todos os códigos `char` exigem `RTRIM` (padding à direita).

## 1. Decisão arquitetural proposta

Duas camadas no Postgres do CGStok:

1. **Mirror (staging)** — schema `infsync` com cópia fiel das linhas do Informakon
   (`inf_insumo`, `inf_unidade`, `inf_centro`, `inf_estoque`, `inf_credor`, …),
   incluindo `sync_hash` (hash dos campos mapeados) e `sync_first_seen`/`sync_last_seen`.
   Permite: reconciliação por contagem/hash, auditoria, detecção de remoção e replay.
2. **Projeção** — upsert nas tabelas do CGStok (`Product`, `ProductUnit`,
   `ProductCategory`, `Worksite`, `Warehouse`, `Supplier`, `Stock`) usando coluna
   nova `informakonKey` (string única) como chave de reconciliação.

Regra de ouro do upsert: **o sync só escreve campos mapeados**. Campos exclusivos do
CGStok (barcode manual, notes, min/max local, defaultLocation, dados operacionais)
nunca são tocados. Registro CGStok sem `informakonKey` = registro próprio, nunca
sobrescrito nem removido pelo sync.

**Chave estável universal**: string `'EMP.FIL.CENTRO[.ITEM]'` ou o código natural da
entidade, conforme tabela — sempre derivada da PK do Informakon (ver coluna
`informakonKey` abaixo). O uuid do CGStok nunca entra na reconciliação.

## 2. Correspondência por entidade

### 2.1 `Unidade` → `ProductUnit`

| Informakon | CGStok | Transformação |
|---|---|---|
| `Unid_Cod` char(10) | `ProductUnit.code` | `RTRIM`; ignorar linha em branco |
| `Unid_Titulo` char(100) | `ProductUnit.name` | `RTRIM`; fallback = code |
| `Unid_IntFrac` ('I'/'F') | — (mirror only) | indica qty inteira/fracionária — ver §4.2 |
| — | `ProductUnit.status` | `'ACTIVE'`; inativar se sumir da fonte |
| `Unid_Cod` | `informakonKey` | `'UNI:'+cod` |

Reload completo a cada ciclo (84 linhas). Diferenças via hash → upsert.

### 2.2 `Classe_de_Insumos` + `Grupo_de_Insumos` → `ProductCategory`

CGStok tem categoria **plana**; Informakon tem 2 níveis (Classe→Grupo).

| Informakon | CGStok | Transformação |
|---|---|---|
| `(ClaIns_Cod, GruIns_Cod)` | `informakonKey` | `'CAT:'+cla+'.'+gru` |
| `GruIns_Titulo` | `ProductCategory.name` | `RTRIM`; colisões de nome → sufixo `[cla.gru]` |
| `ClaIns_Titulo` | `ProductCategory.description` | `'Classe: '+RTRIM` |
| `ClaIns_Obsoleto`/`GruIns_Obsoleto` | `status` | `'S'`→INACTIVE |
| `ClaIns_EStoque` | (regra de filtro, não campo) | ver §3 |

**Pendente ⚠️**: alternativa é `name = 'Classe / Grupo'`. Decidir com o usuário.

### 2.3 `Insumo` → `Product`

| Informakon | CGStok | Transformação |
|---|---|---|
| `Insumo_Cod` int | `informakonKey` | `'INS:'+cod` |
| `Insumo_Cod` | `Product.code` | `String(cod)`; conflito com code existente → ver §4.5 |
| `Insumo_Especificacao` char(255) | `Product.name` | `RTRIM` |
| `Insumo_EspecificacaoOrcamento` | `Product.shortDescription` | `RTRIM` |
| `gtin` | `Product.barcode` | só se não-nulo; não sobrescreve barcode manual? **decisão**: Informakon é fonte → sobrescreve |
| `Unid_Cod` | `Product.unitId` | lookup ProductUnit por `informakonKey='UNI:'+unid` |
| `(ClaIns_Cod,GruIns_Cod)` | `Product.categoryId` | lookup `informakonKey='CAT:cla.gru'` |
| `INSUMO_ITEMOBSOLETO` + `ClaIns_Obsoleto` + `GruIns_Obsoleto` | `Product.status` | qualquer `'S'`→`INACTIVE`, senão `ACTIVE` |
| `Audit_LastChange` | mirror watermark | incremental |
| — | `Product.minimumStock` | **não mapeado no Product** (est. mínimo é por centro — ver §2.6) |
| `Insumo_Referencia`, `COD_NCM`, `Insumo_Comprador` | mirror only | fora do domínio CGStok |

**Filtro de escopo** (§3): só insumos com `ClaIns_EStoque='S'` (estocáveis) —
exclui Mão de Obra/Serviços (22.233 → ~menor). **Confirmar filtro.**

### 2.4 `Empreendimento` / `Cadastro_de_Obras` → `Worksite`

| Informakon | CGStok | Transformação |
|---|---|---|
| `(Empresa_Cod, Filial_Cod, EImo_Numero)` | `informakonKey` | `'OBR:'+emp+'.'+fil+'.'+eimo` = `'OBR:CVP.01.0001'` |
| mesmo | `Worksite.code` | idem (formato `EMP.FIL.000N`) |
| `EImo_Nome` | `Worksite.name` | `RTRIM` |
| `Centro_Inativo`/datas fim | `Worksite.status` | inativo→INACTIVE |

✅ **Decidido**: `Empreendimento` é a fonte do Worksite. `Cadastro_de_Obras`
(cadastro fiscal com CNO/CIB) fica mirror-only.

### 2.5 `Centro_de_Custo` → `Warehouse` (+ vínculo a `Worksite`)

| Informakon | CGStok | Transformação |
|---|---|---|
| `(Empresa_Cod, Filial_Cod, Centro_Cod)` | `informakonKey` | `'CC:'+emp+'.'+fil+'.'+centro` = `'CVP.01.0008'` |
| idem | `Warehouse.code` | `'EMP.FIL.CENTRO'` |
| `Centro_Nome` | `Warehouse.name` | `RTRIM` |
| `EspCentro_Cod` + título da espécie | `Warehouse.description` | ex.: `Obra Própria`, `Almoxarifado Central` |
| `Centro_Inativo`, `Encerrou` | `Warehouse.status` | `'S'`→INACTIVE |
| `Empreendimento_CentrodeCusto.Centro_CodC` | `Warehouse.worksiteId` | `Centro_CodC` (ex. `'CVP010008'`) → parse `emp+fil+centro`; obra↔centro pelo empreendimento que referencia o centro **⚠️ verificar cardinalidade** (1 centro → 1 obra?) |

**Escopo decidido**: **só centros que aparecem em `MateriaisEstoque` ou
`MateriaisEstoqueInsumos`** (12 no treino). Novos centros entram automaticamente
quando receberem o primeiro saldo.

`WarehouseLocation`: Informakon tem `MateriaisEstoquePrateleiras.Estoque_Local`
(char 6) = prateleira/local físico por insumo — **vazia no treino**. Enquanto isso,
criar location `GERAL` por warehouse e aterrar todo `Stock` nela. Se prateleiras
passarem a ser usadas, mapear `Estoque_Local` → `WarehouseLocation.code`.

### 2.6 `MateriaisEstoque` (snapshot mensal) → `Stock`

| Informakon | CGStok | Transformação |
|---|---|---|
| `(Emp,Fil,Centro)` | warehouse | lookup `'CC:…'` |
| `Insumo_Cod` | product | lookup `'INS:'+cod` |
| `SubInsumo_Cod` | — | treino: sempre 0. Se >0, produto = `InsumoSub` **⚠️ decisão**: CGStok não tem subitem — ou vira Product próprio (`'INS:x.y'`) ou ignora |
| `Estoque_AnoMes` (max por item) | — | só o **último AnoMes** vira saldo corrente |
| `Estoque_Quantidade` numeric(14,4) | `Stock.quantity` | **conflito de tipo** — ver §4.2 |
| `Estoque_Valor` / qty | `Product.averageCost` | custo médio por warehouse vs global? CGStok é global no Product — **propor não sincronizar custo** (almox não precisa) ou espelhar no mirror |
| `MateriaisEstoqueMinimo.Estoque_Quantidade` | (mínimo por centro) | CGStok `minimumStock` é por produto global — opções: não sincronizar, ou criar campo por location. **Propor: mirror only** |

Destination location: `GERAL` do warehouse (§2.5). Upsert por
`(productId, locationId)` — unique já existe no schema.

### 2.7 `Credor` → `Supplier`

| Informakon | CGStok | Transformação |
|---|---|---|
| `Cre_Cod` | `informakonKey` | `'CRE:'+cod` |
| `Cre_RazSoc` | `Supplier.name` | `RTRIM` |
| `Cre_Fantasia` | `Supplier.tradeName` | `RTRIM` |
| `Cre_CGCCPF` char(14) | `Supplier.document` | `RTRIM`; **vazio/duplicado → NULL** (unique!) e reconcilia só por informakonKey |
| `Cre_Endereco`+`Cre_Numero`+`Cre_Complto` | `Supplier.address` | concat `', '` |
| `Cre_Bairro`/`Cre_Cidade`/`UF_Sigla`/`Cre_CEP` | `city`/`state`/`zipCode` | `RTRIM` |
| `Cre_InscricaoEstadual`, banco etc. | mirror only | |
| `Esp_Cod` (espécie credor) | — | filtrar? credores incluem clientes/corretores — **propor filtrar só credores presentes em `Material_Fornecedor`/Pedidos**, ou marcar tipo |

### 2.8 `Solicitante` → `User` ⚠️

Solicitantes são as pessoas que requisitam material. CGStok só tem `User`.

| Informakon | CGStok | Transformação |
|---|---|---|
| `Solicitante_Cod` | `User.employeeCode` | `'SOL-'+cod` **ou** casar com funcionário de verdade? **pergunta** |
| `Solicitante_Nome` | `User.name` | `RTRIM` |
| `Solicitante_Ativo` | `User.status` | 'N'→INACTIVE |
| — | `loginEnabled` | `false` (não logam, só existem como destinatários) |

**Alternativa**: criar tabela `Requester` própria no CGStok em vez de inflar `User`.
Decisão do usuário.

### 2.9 ✅ Movimentos — `MateriaisEntrada`/`MateriaisSaida` → `StockMovement`

**Decidido: sincronizar.** `MateriaisEntrada[_Itens]`→`type='ENTRY'`,
`MateriaisSaida[_Itens]`→`type='EXIT'`, `referenceType='INFORMAKON'`,
`referenceId='ENT:n'`/`'SAI:n'`, `documentNumber=DocTipo+DocNumero`,
`performedById`=usuário de sistema `sync-informakon` (criado pelo seed),
`worksiteId`/`warehouseId`/`locationId` do centro. **O `Stock` continua vindo do
snapshot** — os movimentos são trilha auditável, não recalculam saldo.
Item-level: `(Entrada_Numero, EntradaItem_Numero)` / `(Saida_Numero, SaidaItem_Numero)`
como chave de idempotência. `Audit_Insert_Date`/`Audit_LastChange` = watermark.

### 2.10 Fora de escopo (v1) — mirror opcional

`Pedido`/`Pedido_Item` (compras), `Solicitacao_de_Compra` (requisição de compra —
≠ `MaterialRequest` do CGStok que é requisição ao almoxarifado), `Documento_de_Entrada`
(NF-e), `Material_Fornecedor`, `Unidade_Conversao`, `Funcionario_Registro`,
`Empresa`, `Filial` (entram embutidas nas chaves `EMP.FIL.*`).

## 3. Filtros e transformações globais

1. **Multi-empresa**: todas as empresas num CGStok só; chaves `EMP.*` evitam colisão.
   Avisar se quiserem filtrar empresas específicas.
2. **Estocável**: `Classe_de_Insumos.ClaIns_EStoque='S'` filtra insumos de estoque.
3. **Encoding**: `char` com padding → `RTRIM`; texto Latin-1 possível (collate do
   banco é provavelmente `Latin1_General_CI_AS`) — driver já devolve UTF-8; validar acentos.
4. **Datas**: `datetime` SQL Server sem fuso → tratar como `America/Fortaleza` (UTC-3),
   converter para timestamptz no Postgres.
5. **Números**: `numeric(14,4)` → `Float` (double) no Postgres; ver §4.2.
6. **Flags**: `'S'`/`'N'` → boolean/status; `NULL` em flag = assumir 'N'.
7. **Códigos vazios**: linha de `Unidade` em branco e defaults '  ' → ignorar.

## 4. Chaves, conflitos e casos especiais

### 4.1 Reconciliação
- `informakonKey` (string, unique, indexada) em cada tabela projetada + `informakonHash`
  no mirror. Sync = `mirror upsert` → `diff hash` → `projeção upsert`.
- Deleção: item presente no mirror com `sync_last_seen` antigo e ausente na fonte →
  `status=INACTIVE` no CGStok (nunca DELETE físico em dados com histórico referencial).

### 4.2 ✅ `Stock.quantity` migra para `Float` (double)
Relatório oficial "ESTOQUE MAHAY 13-10-26" confirma quantidades fracionárias
(`10152.89`, `4057.795`). Migration: `Stock.quantity`, `Stock.reservedQuantity` e
`quantity`/`reservedQuantity`/`minimumStock`/`maximumStock`/`StockMovement.quantity` Int → `Float`. **Decisão**: `Float` em vez de `Decimal` — o Prisma `Decimal` vira objeto `Decimal` no TS e quebraria toda a aritmética existente do app; `Float` mantém `number` e tem precisão de sobra para 14,4. Ajustar UI/somas
que assumiam inteiro.

### 4.3 Conflito de `Product.code`
Se CGStok já tem produto manual com `code` = código de insumo existente, o upsert
por `informakonKey` cria duplicata de `code` (não é unique no schema — `@@index` só).
Regra: se `code` colidir com produto **não-sincronizado**, manter o do Informakon e
sufixar o antigo ou registrar conflito no relatório de pendências. **Decisão.**

### 4.4 `Supplier.document` unique com CPF/CNPJ vazio
`Cre_CGCCPF` pode vir `''` ou duplicado → gravar `document=NULL` e usar
`informakonKey` para reconciliação.

### 4.5 Dados só-CGStok (não sobrescrever)
`Product.brand/model/notes/maximumStock/defaultLocation`, `Stock.reservedQuantity`,
todos os fluxos operacionais (requests, receipts, transfers, quick issues,
inventários, divergências), `User` com login, permissões — **o sync nunca toca**.

### 4.6 Detecção de mudança — resumo
- Incremental por `Audit_LastChange > watermark` onde existe; watermark por entidade
  em `infsync.checkpoint`.
- Sem coluna de mudança (`Unidade`, `InsumoSub`, `Solicitante`, `MateriaisEstoqueMinimo`,
  `Prateleiras`, `Material_Fornecedor`): **full reload + hash** (todas pequenas,
  exceto `InsumoSub` 22k — ainda leve).
- `MateriaisEstoque`: ler `MAX(Estoque_AnoMes)` por (centro, insumo) → só saldo
  corrente; retroativos: re-ler também `AnoMes` corrente-1 a cada ciclo completo.
- Reconciliação: `COUNT(*)` + `SUM(HASH)` por entidade a cada N ciclos (diário).

## 5. Decisões tomadas (com o usuário, 27/10/2026)

1. **Worksite = `Empreendimento`** — a obra é o empreendimento ("Mahay Residence",
   "Ousy"), não o centro de custo. `Worksite.code='EMP.FIL.EIMO'`
   (`CVP.01.0001`), `name=EImo_Nome`. Warehouse↔Worksite via
   `Empreendimento_CentrodeCusto.Centro_CodC`. `Cadastro_de_Obras` fica mirror-only
   (cadastro fiscal, sem vínculo direto a centros).
2. **Warehouses = só centros com estoque** (presentes em `MateriaisEstoque` ou
   `MateriaisEstoqueInsumos`) — 12 no treino. Demais centros ignorados.
3. **`Stock.quantity` → `Float`** — o relatório oficial "ESTOQUE MAHAY"
   mostra quantidades fracionárias (10152.89, 4057.795). Migration altera
   `Stock.quantity`/`reservedQuantity` (e `quantity` das tabelas de itens, se
   necessário) para `Float` (double).
4. **Saldos + movimentos**: `MateriaisEntrada`→`StockMovement` tipo ENTRY,
   `MateriaisSaida`→ tipo EXIT, `referenceType='INFORMAKON'`,
   `documentNumber=DocNumero`, `performedBy`=usuário de sistema do sync.
   `Stock` continua sendo upsert do snapshot (não recalcula por movimento).
5. **`Product.code` = formato do relatório** `pad6(Insumo_Cod)+'-'+pad3(SubInsumo_Cod)`
   (ex.: `000023-000`). SubInsumo>0 vira Product próprio quando existir.

### Perguntas ainda abertas (defaults propostos — revisar se discordar)

6. Categoria: `name = GruIns_Titulo`, `description='Classe: <titulo>'` (plano).
7. `Solicitante`: mirror-only na v1 (não infla `User`). Revisar se precisar como
   destinatário de requisições.
8. Funcionários: `PFUNC`/`Usuarios`/`Funcionario_Registro` esparsos no treino —
   mirror-only de `Solicitante`; cadastro real continua via XLSX até confirmar
   fonte em produção.
9. Empresa `TST` ("Importação de Eventos Contábeis") **excluída** do sync.
10. Custo: `Estoque_Valor`/preços ficam **no mirror** (não vai para `averageCost`
    nem UI — dado sensível). Revisar se o almoxarifado precisar ver custo.

---

## 6. Esquema FINAL implementado (Fase 4, `qweb-api/src/sync/engine.ts`)

| Entidade (espelho) | Fonte SQL Server | informakonKey / chave | Projeção CGStok |
|---|---|---|---|
| `unidade` | `Unidade` | `UNI:<Unid_Cod>` | `ProductUnit` (code=`UNID`) |
| `categoria` | `Grupo_de_Insumos` | `CAT:<ClaIns_Cod>.<GruIns_Cod>` | `ProductCategory` (name=`GruIns_Titulo`) |
| `obra` | `Empreendimento` | `OBR:<Emp>.<Fil>.<EImo_Numero>` | `Worksite` |
| `centro` | `Centro_de_Custo` — **só almoxarifados**: `EspCentro_Obra='S'` ou `DM`, com linhas em `MateriaisEstoqueInsumos`, excl. nomes administrativos/comerciais (Stand, Receita, Marketing, Folha, Terreno, Incorporação, Financeiro, Escritório…) | `CC:<Emp>.<Fil>.<Centro_Cod>` | `Warehouse` + `WarehouseLocation` `*-GERAL`. Nome normalizado: `"X - Obra (obr)"` → `"X"`. **Adoção**: warehouse local homônimo (sem ik) recebe a `informakonKey` em vez de duplicar — ver `scripts/adopt-almoxarifados.cjs` |
| `insumo` | `Insumo` ⨝ `InsumoSub` | `INS:<pad6>-<pad3>` | `Product` (code=mesmo formato do relatório) |
| `fornecedor` | `Credor` | `CRE:<Cre_Cod>` | `Supplier` |
| `funcionario` | `Funcionario_Registro` (último AnoMes) | `FUN:<Emp>.<Fil>.<Centro>.<RE_Numero>` | `User` (`employeeCode=INF-<Emp>-<RE_Numero>`, `loginEnabled=false`) |
| `estoque` | `MateriaisEstoque` (último AnoMes por chave) | `<cc>~<ins>` | `Stock` (local `GERAL` do warehouse) |
| `entradaItem` | `MateriaisEntrada_Itens` | `<Entrada_Numero>:<item>` | `StockMovement` ENTRY, `referenceId=INF-ENT-*` |
| `saidaItem` | `MateriaisSaida_Itens` | `<Saida_Numero>:<item>` | `StockMovement` EXIT, `referenceId=INF-SAI-*` |

- **Feature flag**: `SystemSetting key='informakon.sync.enabled'` (`'true'`/`'false'`).
  Espelho `InfMirror` é atualizado sempre; a projeção nas tabelas do app só roda
  com a flag ligada. É o interruptor "dados antigos vs sincronizados".
- **Detecção de mudança**: sha256 de `{_v: PROJ_VERSION, ...linha}` no `InfMirror`
  por `(entity, sourceKey)`. Sem rowversion no SQL Server → full-scan + hash a
  cada ciclo (todas as tabelas cabem). `PROJ_VERSION` força re-projeção quando o
  mapeamento muda.
- **Exclusões**: linha ausente na fonte → `deletedAt` no espelho + status
  `INACTIVE` na projeção (estoque → quantity=0). Nunca `DELETE` físico em
  tabela do CGStok.
- **Custos**: `Estoque_Valor`/preços ficam **só no espelho** (decisão do usuário —
  dado sensível); `averageCost`/`unitCost` não são projetados.
- **TST** (`Importação de Eventos Contábeis`) excluída via `SYNC_EXCLUDE_EMPRESAS`.
- **Adoção**: se `code`/`name` local já existe sem `informakonKey`, o sync vincula
  (`UPDATE informakonKey`) em vez de duplicar.
