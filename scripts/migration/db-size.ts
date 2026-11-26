// Diagnóstico: tamanho por tabela no banco apontado por DATABASE_URL.
// Uso: npx tsx scripts/migration/db-size.ts
import { db } from "../../src/lib/db"

async function main() {
  const meta = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT DATABASE() AS db, VERSION() AS version`
  console.log("banco:", meta)

  const tables = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT TABLE_NAME AS name, TABLE_ROWS AS estRows,
           DATA_LENGTH AS dataBytes, INDEX_LENGTH AS indexBytes,
           DATA_FREE AS freeBytes
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC`
  for (const t of tables) {
    const mb = (Number(t.dataBytes) + Number(t.indexBytes)) / 1024 / 1024
    console.log(
      `${String(t.name).padEnd(32)} rows~${String(t.estRows).padStart(7)} ` +
      `total ${mb.toFixed(2).padStart(8)} MB (data ${(Number(t.dataBytes) / 1024 / 1024).toFixed(2)} / idx ${(Number(t.indexBytes) / 1024 / 1024).toFixed(2)} / free ${(Number(t.freeBytes) / 1024 / 1024).toFixed(2)})`
    )
  }

  const growth = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT 'InfMirror' AS src, entity AS k, COUNT(*) AS n,
           MIN(firstSeenAt) AS firstAt, MAX(lastSeenAt) AS lastAt
    FROM InfMirror GROUP BY entity
    UNION ALL
    SELECT 'SyncRun', CONCAT(entity, '/', status), COUNT(*),
           MIN(startedAt), MAX(startedAt)
    FROM SyncRun GROUP BY entity, status
    UNION ALL
    SELECT 'AuditLog', action, COUNT(*), MIN(\`timestamp\`), MAX(\`timestamp\`)
    FROM AuditLog GROUP BY action
    UNION ALL
    SELECT 'ImportBatch', status, COUNT(*), MIN(createdAt), MAX(createdAt)
    FROM ImportBatch GROUP BY status`
  console.log("\ncrescimento recente:", growth)
}

main().finally(() => db.$disconnect())
