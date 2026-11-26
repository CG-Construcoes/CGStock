// Análise complementar (read-only)
import { db } from "../src/lib/db"
import { normalizeNums } from "../src/lib/raw-num"

async function main() {
  // Soma de espaço livre alocado (DATA_FREE) + total em disco estimado
  const agg = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT SUM(data_length) AS d, SUM(index_length) AS i, SUM(data_free) AS f,
           SUM(data_length+index_length+data_free) AS disk
    FROM information_schema.TABLES WHERE table_schema = DATABASE()`
  console.log("agregado (bytes):", agg.map(normalizeNums))

  // Contagens exatas das maiores
  for (const t of ["Supplier", "User", "Product", "Stock", "ImportBatchRow", "UserWarehouseAccess", "AuditLog"]) {
    const r = await db.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*) AS n FROM \`${t}\``)
    console.log(t, "=", Number(r[0].n))
  }

  // Distribuição de fornecedores e usuários por source/status
  console.log("\nSupplier por source:", (await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT source, COUNT(*) n, MIN(registeredAt) oldest, MAX(registeredAt) newest FROM \`Supplier\` GROUP BY source`)).map(normalizeNums))
  console.log("Supplier por category top:", (await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT category, COUNT(*) n FROM \`Supplier\` GROUP BY category ORDER BY n DESC LIMIT 5`)).map(normalizeNums))
  console.log("\nUser por status/loginEnabled:", (await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT status, loginEnabled, COUNT(*) n FROM \`User\` GROUP BY status, loginEnabled`)).map(normalizeNums))
  console.log("\nImportBatch:", (await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT id, status, createdAt FROM \`ImportBatch\` ORDER BY createdAt`)).map(normalizeNums))
  console.log("ImportBatchRow por batch/status:", (await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT batchId, status, COUNT(*) n FROM \`ImportBatchRow\` GROUP BY batchId, status`)).map(normalizeNums))

  // AuditLog: o que está sendo logado
  console.log("\nAuditLog por action:", (await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT action, COUNT(*) n FROM \`AuditLog\` GROUP BY action ORDER BY n DESC`)).map(normalizeNums))
  console.log("AuditLog tamanho médio metadata:", (await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT AVG(LENGTH(JSON_EXTRACT(metadata,'$'))) avgMeta, MAX(LENGTH(JSON_EXTRACT(metadata,'$'))) maxMeta, AVG(LENGTH(userAgent)) avgUA FROM \`AuditLog\``)).map(normalizeNums))

  // Variáveis relevantes
  console.log("\nvars:", (await db.$queryRawUnsafe<Record<string, unknown>[]>(`SHOW VARIABLES WHERE Variable_name IN ('innodb_file_per_table','innodb_default_row_format','log_bin','binlog_expire_logs_seconds')`)).map(normalizeNums))

  // Outros schemas visíveis para este usuário
  console.log("\nschemas:", (await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT table_schema, SUM(data_length+index_length) bytes, SUM(data_free) freeb, COUNT(*) tables FROM information_schema.TABLES GROUP BY table_schema`)).map(normalizeNums))
}

main().finally(() => db.$disconnect())
