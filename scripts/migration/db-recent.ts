// Diagnóstico 2: o que cresceu recentemente no banco.
import { db } from "../../src/lib/db"

async function main() {
  // Tabelas modificadas recentemente (UPDATE_TIME do InnoDB)
  const recent = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT TABLE_NAME AS name, UPDATE_TIME AS upd, CREATE_TIME AS cre
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND UPDATE_TIME IS NOT NULL
    ORDER BY UPDATE_TIME DESC LIMIT 15`
  console.log("tabelas por UPDATE_TIME:", recent)

  // Todos os schemas visíveis (pode haver outro DB na mesma conta)
  const schemas = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT TABLE_SCHEMA AS s,
           SUM(DATA_LENGTH + INDEX_LENGTH) AS totalBytes,
           SUM(DATA_FREE) AS freeBytes,
           COUNT(*) AS tables
    FROM information_schema.TABLES
    GROUP BY TABLE_SCHEMA ORDER BY totalBytes DESC`
  console.log("\nschemas visíveis:", schemas)

  // Histograma diário dos últimos 7 dias nas tabelas grandes
  for (const [table, col] of [
    ["Supplier", "createdAt"], ["User", "createdAt"], ["ImportBatchRow", "id"],
    ["ImportBatch", "createdAt"], ["AuditLog", "timestamp"],
    ["StockMovement", "createdAt"], ["LoginAttempt", "createdAt"],
    ["Stock", "updatedAt"], ["Product", "createdAt"], ["Notification", "createdAt"],
  ] as const) {
    try {
      const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT DATE(\`${col}\`) AS d, COUNT(*) AS n FROM \`${table}\`
         WHERE \`${col}\` >= CURDATE() - INTERVAL 7 DAY
         GROUP BY d ORDER BY d`
      )
      if (rows.length) console.log(`\n${table}.${col} últimos 7d:`, rows)
    } catch (e) {
      console.log(`\n${table}.${col}: (sem coluna de data — pulando)`)
    }
  }

  // ImportBatchRow não tem createdAt — entra via batch
  const ibr = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT b.id AS batch, b.createdAt AS d, b.status, COUNT(*) AS rows_
    FROM ImportBatchRow r JOIN ImportBatch b ON b.id = r.batchId
    GROUP BY b.id, b.createdAt, b.status ORDER BY b.createdAt DESC LIMIT 10`
  console.log("\nImportBatchRow por batch:", ibr)
}

main().finally(() => db.$disconnect())
