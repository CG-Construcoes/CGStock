// OPTIMIZE TABLE — recupera DATA_FREE sem apagar nenhuma linha (rebuild InnoDB)
import { db } from "../src/lib/db"
import { normalizeNums } from "../src/lib/raw-num"

async function main() {
  const before = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT SUM(data_length+index_length) used, SUM(data_free) free FROM information_schema.TABLES WHERE table_schema = DATABASE()`
  )
  console.log("ANTES:", before.map(normalizeNums))

  const tables = await db.$queryRawUnsafe<Array<{ TABLE_NAME: string; DATA_FREE: bigint | number }>>(
    `SELECT TABLE_NAME, DATA_FREE FROM information_schema.TABLES
     WHERE table_schema = DATABASE() AND DATA_FREE > 0 AND ENGINE = 'InnoDB'`
  )
  console.log(`${tables.length} tabelas com espaço livre:`)

  for (const { TABLE_NAME, DATA_FREE } of tables) {
    const res = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `OPTIMIZE TABLE \`${TABLE_NAME}\``
    )
    console.log(
      `  ${TABLE_NAME}: ${(Number(DATA_FREE) / 1024 / 1024).toFixed(1)}M livres ->`,
      res.map(normalizeNums).map((r) => r.Msg_text).join(" | ")
    )
  }

  const after = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT SUM(data_length+index_length) used, SUM(data_free) free FROM information_schema.TABLES WHERE table_schema = DATABASE()`
  )
  console.log("DEPOIS:", after.map(normalizeNums))
}

main().finally(() => db.$disconnect())
