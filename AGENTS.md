<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Integração Informakon (qweb-api)

- A pasta `qweb-api/` é **git-ignorada neste repositório** e tem seu próprio `.git`.
- Repositório da API: https://github.com/CG-Construcoes/nouvelles-API.git — commits e pushes da API vão para lá, **nunca** para o CGStock.
- Mudanças na API (engine de sync, rotas, `.env`) NÃO devem ser commitadas no CGStock.
- A API roda on-premises contra o SQL Server do Informakon **somente leitura** (SELECT/NOLOCK) e projeta no Postgres do CGStock. `SYNC_ENABLED=false` — sincronização manual via `POST /sync/run`.
- Fontes: `MGA@CGSRV2023/dbTREINO_MGA` e `CV@CGSRV2023/dbTREINO_CV`. Almoxarifados visíveis controlados por `SYNC_ALMOX_INCLUDE` em `qweb-api/.env`.
- Migrações Prisma ligadas à integração (ex.: `Stock.unitValue`) ficam neste repo como migrations aditivas, mas só devem ir a produção quando a API estiver alimentando-as.

# Regras de trabalho do usuário

- **Pedido explícito do usuário:** antes de implementar qualquer feature nova, SEMPRE avaliar e confirmar com ele se a feature tem alguma relação/dependência com a `qweb-api`. Se não tiver, seguir 100% dentro do CGStock; se tiver, avisar antes de codar.
- **Tudo vai direto para produção.** Qualquer alteração de banco (schema, migration, update/insert de dados, seed) deve ser comunicada claramente antes/ao executar.
- Exemplo já entregue: a separação de fornecedores/almoxarifados por empresa (MGA/CV) e a importação da planilha "CADASTRO FORNECEDOR" são **features exclusivas do CGStock** — upload manual de `.xlsx` na tela admin, sem nenhuma dependência da `qweb-api`.
