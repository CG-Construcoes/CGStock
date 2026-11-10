// Exporta o backup completo via buildBackupData() do app (mesmo formato
// do botão "Exportar" em /admin/backup). Rodar na branch main (Postgres):
//   DATABASE_URL=postgresql://cgstock:cgstock@127.0.0.1:5433/cgstock \
//     npx tsx scripts/migration/export-backup.ts /tmp/cgstock-export.json
import { writeFileSync } from "node:fs"
import { buildBackupData } from "../../src/lib/backup"

async function main() {
  const out = process.argv[2] ?? "/tmp/cgstock-export.json"
  const data = await buildBackupData()
  writeFileSync(out, JSON.stringify(data))
  const tables = Object.entries(data.tables).map(([k, v]) => `${k}:${v.length}`)
  console.log(`Exportado -> ${out}`)
  console.log(tables.join("  "))
}

main().catch((e) => { console.error(e); process.exit(1) })
