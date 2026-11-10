// Importa o backup JSON no banco alvo via restoreBackupData() do app
// (mesmo código do botão "Restaurar" em /admin/backup). Rodar na branch
// feature/mariadb-migration com o banco MariaDB:
//   DATABASE_URL=mysql://cgstock:cgstock@127.0.0.1:3307/cgstock \
//     npx tsx scripts/migration/import-backup.ts /tmp/cgstock-export.json
import { readFileSync } from "node:fs"
import { restoreBackupData } from "../../src/lib/backup"

async function main() {
  const file = process.argv[2] ?? "/tmp/cgstock-export.json"
  const payload = JSON.parse(readFileSync(file, "utf8"))
  const t0 = Date.now()
  const summary = await restoreBackupData(payload, (p) => {
    if (p.phase === "table") process.stdout.write(`\r${p.done}/${p.total} ${p.table} (${p.rows} linhas)   `)
    else process.stdout.write(`\rLimpando tabelas...   `)
  })
  const totalRows = Object.values(summary).reduce((a, b) => a + b, 0)
  console.log(`\nRestore concluído em ${((Date.now() - t0) / 1000).toFixed(1)}s — ${totalRows} linhas`)
}

main().catch((e) => { console.error(e); process.exit(1) })
