# Contrato da API QWeb (Kiweb / Informakon)

> Levantamento da Fase 1 — API "QWeb" = serviço **Kiweb** (CGI/Delphi `wminformaconcgi.exe`),
> versão observada `23.10.19.1`, rodando em `http://172.16.1.123:85/` (IIS interno, CGSRV2023),
> lendo o banco **dbCONV** (produção). Documento gerado em 27/10/2026.
>
> Legenda: **[CONFIRMADO]** = verificado em código/doc **ou observado ao vivo** · **[INFERIDO]** = só no doc, precisa validar.

---

## 1. Transporte e formato geral

| Item | Valor | Status |
|---|---|---|
| Base URL | `http://172.16.1.123:85/` | [CONFIRMADO] live |
| Protocolo | HTTP 1.1, sem TLS (rede interna) | [CONFIRMADO] live |
| Endpoint | `GET|POST /{endpoint}` direto na raiz (a pasta `/cgi/wminformaconcgi.exe/` vista nos logs antigos **não** responde nesta instalação; o serviço atende na raiz da porta 85) | [CONFIRMADO] live + logs |
| Formato padrão | XML (`Content-Type: application/xml`, encoding ISO-8859-1 na maioria; UTF-8 no `/versao` e nos erros) | [CONFIRMADO] live |
| `formato=json` | Documentado como `json, xml (default)`, porém **observado que é ignorado** — respostas continuam XML mesmo com `formato=json`/`FORMATO=JSON` | [CONFIRMADO] live (comportamento diverge do doc) |
| Headers resposta | `Access-Control-Allow-Origin: *`, `Connection: close` | [CONFIRMADO] live |
| Métodos | Quase tudo `GET` (inclusive operações de escrita como `AlterarSenhaUsurario`); `RegistrarAtendimento` é o único `POST` documentado | [CONFIRMADO] doc |
| Case/acentos | `/versao` responde igual a `/Versão` — rota tolerante a case/acentuação | [CONFIRMADO] live |

## 2. Autenticação

- Modelo por endpoint: credenciais do **cliente final** em querystring — `clilog` (login) + `clisen` (senha), em texto claro na URL. [CONFIRMADO] doc+logs
- **Nem todos os endpoints exigem auth**: `empreendimentos`, `clientes` (com `page`/`pagesize`), `versao` retornam dados sem nenhuma credencial. [CONFIRMADO] live — ⚠️ `clientes` expõe CPF/RG/endereço sem auth (ver Riscos).
- Erro de autenticação: HTTP 200 + XML de erro (abaixo). Ex. observado: `validaUsuario?clilog=xx&clisen=yy` → `CLIENTE INEXISTENTE`. [CONFIRMADO] live

## 3. Erros e respostas vazias

| Situação | Resposta observada | Status |
|---|---|---|
| Param obrigatório faltando/ inválido | HTTP 200, `Content-Type: application/xml`, corpo `<validacaoresultado><validacaoresultado>ERRO</validacaoresultado><tipodeerro>{msg}</tipodeerro></validacaoresultado>` | [CONFIRMADO] live |
| Ex. de mensagens | `page ou pagesize nao informados corretamente.` · `CLIENTE INEXISTENTE` | [CONFIRMADO] live |
| Faltam params p/ consulta pesada | HTTP 200, `Content-Length: 0` (corpo vazio) — ex.: `carteiraTitulosDetParcelas` sem params | [CONFIRMADO] live |
| Auth incorreta (log antigo) | `ERRO - autenticacaoo incorreta` registrado server-side; resposta provável = XML de erro [INFERIDO no formato exato] | [CONFIRMADO] log |
| Sem resultados | XML só com elemento raiz vazio, ex. `<clientes></clientes>` | [CONFIRMADO] live |

- **Nunca** há HTTP 4xx/5xx para erro de negócio — sempre 200. Erros de infra (IIS) sim retornam 404/500 HTML padrão. [CONFIRMADO] live

## 4. Paginação

- Apenas `clientes`, `carteiraTitulosClientesAbertos`, `carteiraTitulosClientesPagos` documentam `page` + `pagesize` (obrigatórios nesses endpoints). [CONFIRMADO] doc+live
- Demais endpoints retornam o conjunto completo filtrado pelos params. [INFERIDO]

## 5. Convenção de chaves (do Layout de Integração v15.3)

Chaves compostas `keyXxx varchar(50)` no formato `Empresa.Filial.Numero` — ex.: `key_empreendimento=CVP.01.0001` (`Empresa_Cod` char(3) + `Filial_Cod` char(2) + `EImo_Numero` int, zero-padded em alguns contextos), `key_contrato=PEI.01.0001.0010` (empresa.filial.eimo.contrato). [CONFIRMADO] doc Layout + live (`<KeyEmpreendimento>CVP.01.0001</KeyEmpreendimento>`)

## 6. Inventário de endpoints

Endpoints documentados (36 únicos). Os únicos observados em uso real no servidor: `clientes` (1299 req), `carteiraTitulosDetParcelas` (39), `empreendimentos` (3), `getlistaobras` (1) — via `/versao`.

| Endpoint | Método | Domínio | Auth (doc) |
|---|---|---|---|
| `/versao` | GET | Sistema | não |
| `/empreendimentos` | GET | Comercial | não (obs.) |
| `/clientes` | GET | Comercial | não (obs.) ⚠️ |
| `/getlistaobras` | GET | Comercial | [INFERIDO] |
| `/carteiratitulosdetparcelas` | GET | Financeiro | [INFERIDO] |
| `/carteiratitulosdetparcelasbycontrato` | GET | Financeiro | [INFERIDO] |
| `/carteiratitulosclientesabertos` | GET | Financeiro | page/pagesize |
| `/carteiratitulosclientespagos` | GET | Financeiro | page/pagesize |
| `/vendasdetimovel` | GET | Comercial | [INFERIDO] |
| `/vendasdetcorret` | GET | Comercial | [INFERIDO] |
| `/recuperacontrato` | GET | Comercial | clilog/clisen |
| `/validausuario` | GET | Segurança | clilog/clisen |
| `/geraplanilhapdf` | GET | Relatórios (PDF) | clilog/clisen |
| `/getcob2avia` | GET | Financeiro (PDF boleto) | clilog/clisen |
| `/geraboleto` | GET | Financeiro | agefin/cobnum |
| `/gerairpdf` | GET | Financeiro (PDF IR) | clilog/clisen |
| `/alterarsenhausurario` | GET | Segurança | clilog/clisen |
| `/enviasenhausuario` | GET | Segurança | cliemail |
| `/geraboletoxml` | GET | Financeiro | agefin/cobnum |
| `/imoveiscliente` | GET | Comercial | clilog/clisen |
| `/contratoalvara` | GET | Comercial | clilog/clisen |
| `/autorizacaoescritura` | GET | Comercial | clilog/clisen |
| `/contatocliente` | GET | Atendimento | clilog/clisen |
| `/tipoatendimento` | GET | Atendimento | clilog/clisen |
| `/grupoatendimento` | GET | Atendimento | clilog/clisen |
| `/subgrupoatendimento` | GET | Atendimento | clilog/clisen |
| `/setorresponsavelatendimento` | GET | Atendimento | clilog/clisen |
| `/ambienteatendimento` | GET | Atendimento | clilog/clisen |
| `/registraratendimento` | **POST** | Atendimento | clilog/clisen |
| `/atendimento` | GET | Atendimento | clilog/clisen |
| `/enviarimagematendimento` | GET | Atendimento | clilog/clisen |
| `/clientesimagens` | GET | Imagens | [INFERIDO] |
| `/contratoimagens` (`/imagens?Tipo=2`) | GET | Imagens | [INFERIDO] |
| `/tiponotificado` | GET | Cobrança | [INFERIDO] |
| `/tiposeventocobranca` | GET | Cobrança | [INFERIDO] |
| `/registroscobrancacontrato` | GET | Cobrança | [INFERIDO] |

> **Gap crítico**: nenhum endpoint documentado cobre **insumos/estoque/almoxarifado/fornecedores** — o domínio que o CGStok precisa. O módulo `Supply` existe apenas na `Informakon.Api` (.NET, outra API). Isso será tratado na Fase 2/4 diretamente no banco.

---

## 7. Detalhe por endpoint

### `GET /carteiratitulosdetparcelas`

Exemplo (doc): `{base}/carteiraTitulosDetParcelas?data_inicial=01/10/2019&data_final=30/05/2020&situacao=AB`

| Param | Descrição (doc) |
|---|---|
| `data_inicial` | data de vencimento (parcelas em aberto), data de pagamento (parcelas liquidadas) |
| `data_final` | data de vencimento (parcelas em aberto), data de pagamento (parcelas liquidadas) |
| `data_ref` | data de referência para cálculo e retroatividade de situação da parcela |
| `key_empreendimento` | chave do empreendimento |
| `formato` | json, xml (default) |

Campos de retorno (doc): `Key_Empreendimento`, `Key_Centro`, `Key_Nucleo`, `Key_Contrato`, `Contrato`, `Key_Cliente`, `AnoVencto`, `MesVencto`, `DataVencimento`, `ElementoPreco_Cod`, `ElementoPreco_Titulo`, `ValorPrincipal`, `ValorReajuste`, `ValorJurosCon`, `ValorParcela`, `ValorEncFin`, `ValorMulta`, `ValorJurosMora`, `ValorDesconto`, `ValorTotal`, `AnoPagto`, `MesPagto`, `DataPagto`, `ValorPago`, `ValorEmAberto`, `ImovelExtenso`, `Situacao`, `DataReferencia`

Observado: sem params → HTTP 200 com corpo vazio (`Content-Length: 0`).

Status: [CONFIRMADO] live (endpoint existe e valida params) / [INFERIDO] (formato de dados)

---

### `GET /carteiratitulosdetparcelasbycontrato`

Exemplo (doc): `{base}/carteiraTitulosDetParcelasByContrato?data_inicial=01/10/2019&data_final=30/05/2020&situacao=AB&key_contra`

| Param | Descrição (doc) |
|---|---|
| `data_inicial` | data de vencimento (parcelas em aberto), data de pagamento (parcelas liquidadas) |
| `data_final` | data de vencimento (parcelas em aberto), data de pagamento (parcelas liquidadas) |
| `data_ref` | data de referência para cálculo e retroatividade de situação da parcela |
| `situacao` | situação da parcela: AB (apenas em aberto), LI (apenas liquidadas) |
| `key_contrato` | chave do contrato |
| `cliente_cpfcnpj` | CPF/CNPJ do cliente |
| `formato` | json, xml (default) |

Campos de retorno (doc): `Key_Empreendimento`, `Key_Centro`, `Key_Nucleo`, `Key_Contrato`, `Contrato`, `Key_Cliente`, `AnoVencto`, `MesVencto`, `DataVencimento`, `ElementoPreco_Cod`, `ElementoPreco_Titulo`, `ValorPrincipal`, `ValorReajuste`, `ValorJurosCon`, `ValorParcela`, `ValorEncFin`, `ValorMulta`, `ValorJurosMora`, `ValorDesconto`, `ValorTotal`, `AnoPagto`, `MesPagto`, `DataPagto`, `ValorPago`, `ValorEmAberto`, `ImovelExtenso`, `Situacao`, `Cliente_CPFCNPJ`, `DataReferencia`, `Tit_Numero`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /vendasdetimovel`

Exemplo (doc): `{base}/vendasDetImovel?key_empreendimento=SGD.01.0001&key_cliente=2555&data_ref=28/04/2020&nao_autorizad`

| Param | Descrição (doc) |
|---|---|
| `key_empreendimento` | chave do empreendimento |
| `key_cliente` | chave do cliente |
| `cliente_cpfcnpj` | CPF/CNPJ do cliente |
| `data_ref` | data de referência para retroatividade de situação do contrato |
| `nao_autorizados` | incluir contratos não autorizados: S (inclui), N (não inclui) |
| `formato` | json, xml (default) |

Campos de retorno (doc): `Key_Empreendimento`, `Key_Centro`, `Key_Nucleo`, `Empreendimento`, `MesContrato`, `AnoContrato`, `DataContrato`, `Setor`, `Edificacao`, `Key_Imovel`, `Imovel`, `Key_Cliente`, `Cliente`, `Cliente_CPFCNPJ`, `Key_Contrato`, `Contrato`, `ContratoAlternativo`, `ValorVendaAVista`, `ValorContrato`, `Key_Imobiliaria`, `Imobiliaria`, `Imobiliaria_CPFCNPJ`, `Key_Corretor`, `Corretor`, `Corretor_CPFCNPJ`, `Key_Corretor`, `Corretor`, `Corretor_CPFCNPJ`, `Contrato_Situacao`, `Contrato_UsuarioCriacao`, `Contrato_DataCriacao`, `Contrato_UsuarioAutorizacao`, `Contrato_DataAutorizacao`, `DataReferencia`, `ImovelArea`, `ImovelEspecie`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /vendasdetcorret`

Exemplo (doc): `{base}/vendasDetCorret?key_empreendimento=SGD.01.0001&key_cliente=2555&data_ref=28/04/2020&nao_autorizado`

| Param | Descrição (doc) |
|---|---|
| `key_empreendimento` | chave do empreendimento |
| `key_cliente` | chave do cliente |
| `cliente_cpfcnpj` | CPF/CNPJ do cliente |
| `data_ref` | data de referência para retroatividade de situação do contrato |
| `nao_autorizados` | incluir contratos não autorizados: S (inclui), N (não inclui) |
| `formato` | json, xml (default) |

Campos de retorno (doc): `Key_Empreendimento`, `Empreendimento`, `DataContrato`, `Key_Contrato`, `Contrato`, `ContratoAlternativo`, `Key_Corretor`, `Corretor_RazaoSocial`, `Corretor_NomeFantasia`, `Corretor_CPFCNPJ`, `Corretagem_Perc`, `Corretagem_RedutorPerc`, `Corretagem_Valor`, `Corretagem_AClassificar`, `Corretagem_Destacada`, `Corretagem_Obs`, `DataReferencia`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /recuperacontrato`

Exemplo (doc): `{base}/recuperaContrato?clilog=031950&clisen=1505&empreecod=SGD.01.0001&contrato_numero=1084&data_ref=30/`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |
| `Empreecod` | código do empreendimento |
| `Contrato_Numero` | Número do contrato |
| `DataRef` | Data de Referência |
| `VPL` | Valor das parcelas vincendas com ou sem VPL |
| `INCTX` | Incluir taxas extras (S ou N) |

Campos de retorno (doc): `Empreendimento`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /validausuario`

Exemplo (doc): `{base}/validaUsuario?clilog=sa&clisen=0502`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |

Campos de retorno (doc): `cliente_nome`, `cliente_cpf`, `cliente_rg`, `cliente_telefone`, `cliente_email`, `cliente_endereco`, `cliente_endereco_logradouro`, `cliente_endereco_numero`, `cliente_endereco_compl`, `cliente_endereco_pais`, `cliente_bairro`

Observado: com credenciais inválidas → HTTP 200 + `<validacaoresultado>ERRO</validacaoresultado><tipodeerro>CLIENTE INEXISTENTE</tipodeerro>`.

Status: [CONFIRMADO] live (caminho de erro) / [INFERIDO] (caminho de sucesso)

---

### `GET /geraplanilhapdf`

Exemplo (doc): ` {base}/geraplanilhapdf?clilog=sa&clisen=0502&empreecod=MEI.01.0001&Contrato_Numero=0003&D`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |
| `empreecod` | código do empreendimento |

Campos de retorno (doc): `Restrições do ListaParcelas:`, `- Pelo menos um dos seguintes campos precisa estar selecionado: Data_Vencimento, Tipo, Parcela,`, `Data_Pagamento.`, `- Campos Obrigatórios:`, `Valor_Total,Valor_Encargos_Fin,Valor_Multa,Valor_Juros_Mora,Valor_Desconto,Valor_Parcela`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /getcob2avia`

Exemplo (doc): `{base}/getcob2avia?clilog=031950&clisen=1505&Data_Ref=09/03/2020 &TODOS_BOLETOS=S`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |
| `empreecod` | Código do Empreendimento |
| `Todos_Boletos` | Listagem de Todos os Boletos do cliente |

Campos de retorno (doc): `validacaoresultado`, `cliente_nome`, `listacobrancas`, `cobranca_item`, `EmpreeCod`, `AnoMesCob`, `Contrato_Numero`, `cobranca_vencimento`, `cobranca_valor`, `cobranca_valor_fmt`, `agefin_id`, `cobranca_numerodocumento`, `parcelas`, `idparcela`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /geraboleto`

Exemplo (doc): `{base}/geraboleto?agefin=BC237&cobnum=0000146033`

| Param | Descrição (doc) |
|---|---|
| `agefin` | agente financeiro |
| `cobnum` | número de cobrança |

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /gerairpdf`

Exemplo (doc): `{base}/gerairpdf?clilog=028446&clisen=8746&empreecod=PEI.01.0001&Contrato_Numero=0009&Data_Ref=09/03/2019`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |
| `empreecod` | código do empreendimento |
| `contrato_numero` | número do contrato |
| `data_ref` | data de referência para cálculo |

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /getlistaobras`

Exemplo (doc): `{base}/getlistaobras`

Sem parâmetros documentados.

Retorno (doc): raiz `<Listaobras>` → `<Obra>` com `Empresa_Cod`, `Filial_Cod`, `Centro_Cod`, `Centro_Nome`.

Observado: chamada sem params retornou `Content-Type: text/html` e corpo literal `obra` — comportamento anômalo (talvez exija auth ou header específico).

Status: [INFERIDO] — endpoint existe (registrado em `/versao`), mas resposta observada não corresponde ao doc

---

### `GET /alterarsenhausurario`

Exemplo (doc): `{base}/alterasenhausuario?clilog=031950&clisen=1010&clinovasen=1505`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |
| `clinovasen` | nova senha do usuário |

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /enviasenhausuario`

Exemplo (doc): `{base}/enviasenhausuario?clilog=031950&cliemail=tonelima@konstroi.com`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `cliemail` | email do usuário |

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /geraboletoxml`

Exemplo (doc): `{base}/geraboletoxml?agefin=BC237&cobnum=0000146033`

| Param | Descrição (doc) |
|---|---|
| `agefin` | agente financeiro |
| `cobnum` | número de cobrança |

Campos de retorno (doc): `linha_digitavel`, `codigo_barras`, `vencimento`, `valor_documento`, `contrato`, `imovel`, `parcelas`, `parcela`, `numero`, `valor`, `tipo`, `pagador`, `nome`, `endereco`, `bairro`, `cidade`, `estado`, `cep`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /imoveiscliente`

Exemplo (doc): `{base}/imoveiscliente?clilog=027382&clisen=6677`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |

Campos de retorno (doc): `Imovel`, `Imovel`, `Valor`, `Escriturado`, `Edificacao`, `Contrato_alternativo`, `EMPREECOD`, `CONTRATO_NUMERO`, `IMO_NUMERO`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /contratoalvara`

Exemplo (doc): `{base}/contratoalvara?clilog=062743&clisen=9594&EMPREECOD=MEI.01.1&contrato_numero=0001&imo_numero=2`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |
| `empreecod` | código do empreendimento |
| `contrato_numero` | número do contrato |
| `imo_numero` | número do imóvel |

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /autorizacaoescritura`

Exemplo (doc): `{base}/autorizacaoescritura?clilog=037375&clisen=1347&EMPREECOD=PEI.01.1&contrato_numero=0143&imo_numer`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |
| `empreecod` | código do empreendimento |
| `contrato_numero` | número do contrato |
| `imo_numero` | número do imóvel |

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /contatocliente`

Exemplo (doc): `{base}/contatoCliente?clilog=025557&clisen=5312`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |

Campos de retorno (doc): `contato`, `Cliente`, `CargoFuncao`, `Parentesco`, `Departamento`, `Telefone`, `Fax`, `eMail`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /tipoatendimento`

Exemplo (doc): `{base}/tipoAtendimento?clilog=025557&clisen=5312`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |

Campos de retorno (doc): `tipoAtendimento`, `TipoAtendimento_Cod`, `TipoAtendimento_Nome`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /grupoatendimento`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |
| `SetorResponsavel_Cod` | Código do setor |

Campos de retorno (doc): `gruposAtendimento`, `SetorResponsavel_Cod`, `GrupoChamado_Cod`, `GrupoChamado_Nome`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /subgrupoatendimento`

Exemplo (doc): `{base}/subGrupoAtendimento?clilog=025542&clisen=0033&GrupoChamado_Cod=5`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |
| `grupochamado_cod` | Código do grupo |

Campos de retorno (doc): `subGrupoAtendimento`, `GrupoChamado_Cod`, `SubGrupoChamado_Cod`, `SubGrupoChamado_Nome`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /setorresponsavelatendimento`

Exemplo (doc): `{base}/setorResponsavelAtendimento?clilog=025542&clisen=0033`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |

Campos de retorno (doc): `setorResponsavelAtendiment`, `o`, `SetorResponsavel_Cod`, `SetorResponsavel_Nome`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /ambienteatendimento`

Exemplo (doc): `{base}/ambienteAtendimento?clilog=025542&clisen=0033&SetorResponsavel_Cod=21`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |
| `SetorResponsavel_Cod` | Código do setor |

Campos de retorno (doc): `ambienteAtendimento`, `SetorResponsavel_Cod`, `Ambiente_Cod`, `Ambiente_Nome`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `POST /registraratendimento`

Exemplo (doc): `{base}/registrarAtendimento?CLILOG=001671&CLISEN=6884`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |

Campos de retorno (doc): `EmpreeCod`, `Contrato_Numero`, `CliCom_Seq`, `Contrato`, `TipoAtendimento_Cod`, `SetorResponsavel_Cod`, `GrupoChamado_Cod`, `SubGrupoChamado_Cod`, `Ambiente_Cod`, `Solicitacao_Assunto`, `Solicitacao_Texto`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /atendimento`

Exemplo (doc): `{base}/atendimento?CLILOG=026826&CLISEN=6279`

| Param | Descrição (doc) |
|---|---|
| `clilog` | login do usuário |
| `clisen` | senha do usuário |

Campos de retorno (doc): `Empresa_Cod`, `Código do Empreendimento`, `Filial_Cod`, `Código da Filial`, `EImo_Numero`, `Número Imóvel`, `Contrato_Numero`, `Número do Contrato`, `Atendimento_Numero`, `Número do Atendimento`, `Solicitacao_Data`, `Data da Solicitação`, `Solicitacao_Assunto`, `Assunto da Solicitação`, `Cli_Cod`, `Código Cliente`, `CliCom_Seq`, `Código sequencial do contrato`, `Solicitacao_Texto`, `Texto da Solicitação`, `Destinacao_Data`, `Data`, `EImoCom_Seq`, `Destinatário`, `Atendimento_Situacao`, `Situação do Atendimento`, `Solucao_Data`, `Data da Solução`, `Solucao_Texto`, `Texto da Solução`, `Visita_Data`, `Data da Visita`, `Visita_Hora`, `Hora da Visita`, `Servico_DataInicio`, `Data do inicio do Serviço`, `Servico_DataTermino`, `ManutencaoGrupo_Cod`, `Atendente_Cod`, `MeioAtendimento_Cod`, `TipoAtendimento_Cod`, `SetorResponsavel_Cod`, `GrupoChamado_Cod`, `SubGrupoChamado_Cod`, `Ambiente_Cod`, `Prazo_Estimado`, `Tipo_Cliente`, `Prioridade_COd`, `Complexidade_Cod`, `DocDig_Numero_Solicitacao`, `Solicitação`, `DocDig_Numero_Atendiment`, `o`, `Reserva_Numero`, `Imo_Numero`, `Cliente_Condominio`, `SituacaoAtendimento_Cod`, `Atendimento`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /enviarimagematendimento`

Exemplo (doc): `{base}/enviarImagemAtendimento?CLILOG=001671&CLISEN=6884&EmpreeCod=EXA.01.0005&Atendimento_Numero`

| Param | Descrição (doc) |
|---|---|
| `Clilog` | Login do usuário |
| `Clisen` | Senha do usuário |
| `EmpreeCod` | Código do Empreendimento |
| `Atendimento_Numero` | Número do Atendimento |

Campos de retorno (doc): `Atendimento`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /carteiratitulosclientesabertos`

Exemplo (doc): `{base}/carteiraTitulosClientesAbertos? page=1&pagesize=100&Empresa=SGD&Filial=01&Eimo=1&Contrato=0959`

| Param | Descrição (doc) |
|---|---|
| `Page` | Define a quantidade de dados a serem retornados - Obrigatório |
| `PageSize` | Define a posição baseada no parâmetro acima - Obrigatório |
| `Cliente` | Código do Cliente |
| `Empresa` | Código da Empresa |
| `Filial` | Código da Filial |
| `Eimo` | Código do Empreendimento |
| `Contrato` | Número do contrato |

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /carteiratitulosclientespagos`

Exemplo (doc): `{base}/carteiraTitulosClientesPagos?page=1&pagesize=100&Cliente=96&Empresa=SGD&Filial=01&Eimo=1&Contrato=`

| Param | Descrição (doc) |
|---|---|
| `Page` | Define a quantidade de dados a serem retornados - Obrigatório |
| `PageSize` | Define a posição baseada no parâmetro acima - Obrigatório |
| `Cliente` | Código do Cliente |
| `Empresa` | Código da Empresa |
| `Filial` | Código da Filial |
| `Eimo` | Código do Empreendimento |
| `Contrato` | Número do contrato |

Campos de retorno (doc): `Empresa`, `Filial`, `EImo`, `Contrato`, `ID_Contrato`, `Cod.Cliente`, `NomeCliente`, `Dt.Nascimento`, `CPFCNPJ`, `RG`, `Sexo`, `LOGRADOURO_RES`, `COMPLEMENTO_RES`, `BAIRRO_RES`, `CEP_RES`, `CIDADE_RES`, `ESTADO_RES`, `LOGRADOURO_COB`, `COMPLEMENTO_COB`, `BAIRRO_COB`, `CEP_COB`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /empreendimeentos` (na prática `/empreendimentos`)

Exemplo (doc): `{base}/ empreendimentos?Empresa=SGD`

| Param | Descrição (doc) |
|---|---|
| `Empresa` | Código da Empresa (opcional — sem ele retorna todos) |

Campos de retorno (observados): raiz `<empreendimentos>` → `<empreendimento>` repetido com `Empresa_Cod`, `Filial_Cod`, `EImo_Numero`, `Centro_Cod`, `EImo_Nome`, `EImo_InfoDataIniObra`, `EnderecoCompleto`, `Filial_CNPJ`, `Endereco`, `Numero`, `Complemento`, `Bairro`, `Cidade`, `UF`, `Cep`, `KeyEmpreendimento` (formato `EMPRESA.FILIAL.EIMO` zero-padded, ex.: `CVP.01.0001`).

Status: [CONFIRMADO] live — **sem auth**, retorna dados reais; `formato=json` ignorado; `Empresa=XXX` inexistente → `<empreendimentos></empreendimentos>` vazio

---

### `GET /clientes`

Exemplo (doc): `{base}/clientes?Codigo=2554`

| Param | Descrição (doc) |
|---|---|
| `Codigo` | código do cliente ou Numero CPF / CNPJ |
| `Telefone` | Numero do telefone do Cliente (Numerico) |
| `page` | **[obrigatório]** número da página (observado — sem ele retorna erro `page ou pagesize nao informados corretamente.`) |
| `pagesize` | **[obrigatório]** tamanho da página |

Campos de retorno (doc): `COD.CLIENTE`, `NOMECLIENTE`, `DT.NASCIMENTO`, `CPFCNPJ`, `RG`, `EMAILCLIENTE`, `SEXO`, `LOGRADOURO_RES`, `COMPLEMENTO_RES`, `BAIRRO_RES`, `CEP_RES`, `CIDADE_RES`, `ESTADO_RES`, `LOGRADOURO_COB`, `COMPLEMENTO_COB`, `BAIRRO_COB`, `CEP_COB`, `CIDADE_COB`, `ESTADO_COB`, `LOGRADOURO_COM`, `COMPLEMENTO_COM`, `BAIRRO_COM`, `CEP_COM`, `CIDADE_COM`, `ESTADO_COM`

Observado: campos extras no retorno real — `KEYCLIENTE`, `FOTOCLIENTE` etc. Raiz `<clientes>` → `<cliente>` repetido.

Status: [CONFIRMADO] live — **sem auth, expõe CPF/RG/endereço**; `Codigo=2554` sem resultado → `<clientes></clientes>`

---

### `GET /clientesimagens`

Exemplo (doc): `  {base}/Imagens?Tipo=1&cliente=3576`

| Param | Descrição (doc) |
|---|---|
| `Tipo` | Código do tipo de Cliente |
| `cliente` | Código Do Cliente |

Campos de retorno (doc): `item`, `descricao`, `classname`, `cliente`, `doc`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /versão`

Exemplo (doc): `{base}/Versão`

Sem parâmetros documentados.

Campos de retorno (doc): `Empresa`, `RespostaBanco`, `Versao`, `Banco`, `Servidor`, `CountRequisicoes`, `ConsumoMemoria`, `TempoEmExecucao`, `Kiweb`, `Request`, `Count`, `TimeMin`, `TimeMax`, `TimeMedia`, `Imagens`, `TimeMin`, `TimeMax`, `TimeMedia`

Resposta real (observada em `GET /versao` — também responde sem acento): XML UTF-8 com `<result>` contendo `Empresa`, `RespostaBanco`, `versaoInformakon`, `Banco` (= `dbCONV`), `Servidor`, `Requisicoes`, `RequisicoesInt`, `ConsumoMemoria`, `TempoEmExecucao`, `versaoKiWeb` e `<request>` com um bloco por endpoint já chamado (`Count`, `TimeMin`, `TimeMax`, `TimeMedia`).

Status: [CONFIRMADO] live — sem auth; ignora `formato=json`

---

### `GET /contratoimagens`

Exemplo (doc): `{base}/Imagens?Tipo=2&Empresa=ALD&Filial=01&EImo=0002&Contrato=0282`

| Param | Descrição (doc) |
|---|---|
| `Tipo` | Código Tipo de Imagem |
| `Empresa` | Código Da Empresa |
| `Filial` | Código da Filial |
| `Eimo` | Código do Empreendimento |
| `Contrato` | Número de Contrato |

Campos de retorno (doc): `Classname`, `Empresa`, `Filial`, `Eimo`, `Contrato`, `Doc`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /tiponotificado`

Exemplo (doc): `{base}/tipoNotificado`

Sem parâmetros documentados.

Campos de retorno (doc): `tiposNotificados`, `tipoNotificado`, `Notificacao_Cod`, `Notificacao_Titulo`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /tiposeventocobranca`

Exemplo (doc): `{base} /TiposEventoCobranca`

Sem parâmetros documentados.

Campos de retorno (doc): `tiposEventosCobrancas`, `tipoEventoCobranca`, `AgeCobEvt_Cod`, `AgeCobEvt_Titulo`, `AgeCobEvt_Notificacao_Cod`, `AgeCobEvt_Notificacao_Titulo`, `AgeCobEvt_GerarNotificacao`, `Audit_UserName`, `Audit_LastChange`, `Audit_Insert_UserName`, `Audit_Insert_Date`

Status: [INFERIDO] (documentado, não observado com dados)

---

### `GET /registroscobrancacontrato`

Exemplo (doc): `{base}/RegistrosCobrancaContrato?EMPREECOD=VEN.01.0001&CONTRATO_NUMERO=0445`

| Param | Descrição (doc) |
|---|---|
| `DATA_INICIAL` | Início do período de consulta |
| `DATA_FINAL` | Fim do período de consulta |
| `EMPREECOD` | Código do Empreendimento |
| `CONTRATO_NUMERO` | Número de Contrato |

Campos de retorno (doc): `RegistrosCobrancasContratos`, `RegistrosCobrancasContrato`, `Empresa_Cod`, `Filial_Cod`, `EImo_Numero`, `Contrato_Numero`, `Contrato_Seq`, `Registro`, `AgeCobEvt_Cod`, `AgeCobEvt_Titulo`, `AgeCobRegEvt_Data`, `AgeCobRegEvt_Memo`, `AgeCobRegEvt_DataProxRegEvt`, `AgeCobRegEvt_CodProxRegEvt`, `AgeCobRegEvt_TituloProxRegEvt`, `Encerrado`, `AgenteCobranca_Cod`, `AgenteCobranca_Nome`, `EMPREECOD`

Status: [INFERIDO] (documentado, não observado com dados)

---


## 8. Outros materiais analisados

- `Kiweb/Logs/*.txt` — logs de request/response reais (`CarteiraTitulosDetParcelas*`), confirmam URI `/cgi/wminformaconcgi.exe/{endpoint}` na instalação antiga e o ciclo `TResponseKonstroi` (Delphi). [CONFIRMADO]
- `Layout_Integracao_Informakon_v15` — web-service de integração **diferente** (OP001–OP095, com POST/PUT/DELETE, módulo Comercial). Não é a QWeb/Kiweb, mas documenta a estrutura de chaves composta usada no banco — útil para a Fase 2. Fora do escopo de replicação.
- `InformakonApi/` — segunda API da Informakon (ASP.NET Core + JWT + Swashbuckle, módulos Finance/DMS/Engineering/RealEstate/**Supply**). Somente binários — sem descompilação (regra do projeto). Se estiver no ar internamente, `/swagger` daria o contrato dela, mas não é a QWeb alvo.

## 9. Riscos e observações de segurança (herdados da QWeb)

1. **Dados pessoais sem auth**: `/clientes` expõe nome, CPF, RG, nascimento e endereço de todos os clientes apenas com `page`/`pagesize`. Na API própria, manter compat de contrato **mas colocar auth própria na frente** (Fase 3).
2. Credenciais em querystring (`clilog`/`clisen`) vazam em logs de proxy — a API própria deve aceitar esses params por compat mas autenticar via header/API key própria.
3. `formato=json` é no-op na versão observada — consumidores atuais recebem XML sempre. A API própria replica isso (XML default) e pode oferecer JSON real como extensão opcional.
4. `/versao` expõe métricas internas (memória, contadores) — replicar formato mas avaliar exposição.

---

## 8. API de Integração REST (descoberta — `/informaconws/ws/`, WildFly, porta 9090)

[CONFIRMADO — live 27/10/2026] Além da QWeb (CGI, :85), o servidor expõe uma
segunda API: a **API de Integração** documentada no `Layout_Integracao_Informakon_v15`.

| Item | Valor |
|---|---|
| Base interna | `http://172.16.1.123:9090/informaconws/ws/` [CONFIRMADO] |
| Base externa (e-mail do fornecedor) | `http://177.22.35.89:9090/informaconws/ws/` ⚠️ **exposta na internet** |
| Auth | HTTP Basic — usuário `integracao` (sem acento; `integração` em UTF-8 → 401). Senha consta no e-mail do fornecedor — **não replicar para o repo** |
| Stack | WildFly 10 / Undertow (JAX-RS), CORS `*`, métodos GET/POST/PUT/DELETE |
| Resposta | JSON (`application/json`) |
| Exemplo confirmado | `GET /informaconws/ws/empreendimento` → 200, array JSON completo |

Catálogo (extraído do Layout v15 — ~40 recursos): `cliente`, `clienteEspecie`,
`contrato` (+`alterarContrato`, `cadastrarContrato`, `renegociacao`, `rescisao`,
`complete`, `onlyKeys`, `exists/{key}`), `contratoSerieTaxaExtra`, `corretagem`,
`corretor` (+`corretorFuncao`, `cpfCnpj/{cpf}`), `credorEspecie`, `edificacao`,
`elementoPreco`, `empreendimento` (+`autoUpdateKey`, `updateKey`, `exists`),
`imovel` (+`alteraSituacaoImovel`), `moeda`/`moedaValor`, `municipio`,
`nacionalidade`, `pais`, `parametros/posChaves`, `profissao`, `reserva`,
`tabelaPreco`, `tipoTaxaExtra`, `titulo` (+`liquidar`, `cancelarLiquidacao`,
`subparcelar`, `prorrogarVencimento`), `cessaoDireito`.

Observações:
- **Nenhum recurso de suprimento** (insumo/estoque/fornecedor/filial de
  almoxarifado) — o domínio de estoque só existe via SQL direto. Nossa decisão
  de sync pelo banco se mantém.
- Esta API é voltada ao **CRM de vendas/incorporação** (clientes, contratos,
  corretores, títulos). Fora do escopo do CGStok, mas documentada aqui por ser
  superfície legítima de consulta futura (ex.: dados comerciais das obras).
- ⚠️ Risco: `177.22.35.89` expõe **as duas** APIs na internet (QWeb sem auth +
  integração com credencial fixa circulando por e-mail). Recomendado fechar o
  acesso externo ou trocar a credencial.
