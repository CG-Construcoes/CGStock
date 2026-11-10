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

# Migração PostgreSQL → MariaDB (Hostinger)

- Branch de trabalho: `feature/mariadb-migration`. Destino: app + banco MariaDB 10.11 na Hostinger (plano Unlimited), saindo da Vercel/Neon.
- `docker-compose.migration.yml` sobe o par de teste local: `pg-source` (Postgres 17, :5433) e `mariadb-target` (10.11, :3307, utf8mb4_unicode_ci). Credenciais locais: `cgstock`/`cgstock`.
- Rodar app/testes contra o MariaDB local: `DATABASE_URL="mysql://cgstock:cgstock@127.0.0.1:3307/cgstock" npm run dev` (env de shell sobrepõe `.env`).
- Decisões de conversão já tomadas:
  - `relationJoins` removido (MariaDB não suporta LATERAL/correlated joins do Prisma).
  - `mode: 'insensitive'` removido (collation `utf8mb4_unicode_ci` já é case/accent-insensitive).
  - `ProductUnit.code` usa `utf8mb4_bin` — 'M²' e 'M2' coexistiam no Postgres e colidem sob unicode_ci. Comparisons nessa coluna ficam case-sensitive (fiel ao Postgres).
  - Campos de texto livre viraram `@db.Text` (Postgres `String`→`text` ilimitado; MariaDB `varchar(191)` truncava `Product.name`/`productName` de 255 chars).
  - Restore do backup (`src/lib/backup.ts`) usa `SET FOREIGN_KEY_CHECKS=0` + `DELETE` (MariaDB `TRUNCATE` causa commit implícito e mataria a transação).
  - `$queryRaw` no MariaDB devolve `COUNT`/`SUM` como `BigInt`/`Decimal` → `src/lib/raw-num.ts` (`normalizeNums`) converte pra `number` antes de serializar.
  - `String` em colunas únicas/índices continua `varchar(191)` — TEXT não pode ser indexada por inteiro.
- Veículo oficial de migração de dados: a **própria feature de backup** (`/admin/backup`). O JSON exportado no Postgres (Vercel/Neon) é engine-agnostic e restaura no MariaDB. Validado ponta a ponta: 45.361 linhas em ~5s, contagens idênticas nas 46 tabelas.
- Scripts em `scripts/migration/`: `export-backup.ts` (Postgres→JSON), `import-backup.ts` (JSON→banco atual), `collision-scan.ts` (detecta duplicatas sob unicode_ci), `smoke.ts` (bateria de queries MariaDB).
- ⚠️ `qweb-api` compartilha este `schema.prisma` (`"schema": "../prisma/schema.prisma"`): após esta mudança, o `prisma generate` dela produz client MySQL. Como a API está descartada por ora, se for revivida precisa da mesma conversão + apontar pro MariaDB (Remote MySQL com IP fixo da empresa).
- Dumps (`*.dump`, `*.sql.gz`) são git-ignorados — contêm dados reais de produção.

# Regras de trabalho do usuário

- **Pedido explícito do usuário:** antes de implementar qualquer feature nova, SEMPRE avaliar e confirmar com ele se a feature tem alguma relação/dependência com a `qweb-api`. Se não tiver, seguir 100% dentro do CGStock; se tiver, avisar antes de codar.
- **Tudo vai direto para produção.** Qualquer alteração de banco (schema, migration, update/insert de dados, seed) deve ser comunicada claramente antes/ao executar.
- Exemplo já entregue: a separação de fornecedores/almoxarifados por empresa (MGA/CV) e a importação da planilha "CADASTRO FORNECEDOR" são **features exclusivas do CGStock** — upload manual de `.xlsx` na tela admin, sem nenhuma dependência da `qweb-api`.
