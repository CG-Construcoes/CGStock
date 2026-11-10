// Smoke test MariaDB: executa as queries raw reescritas + leituras Prisma
// comuns + round-trip do export. DATABASE_URL=mysql://cgstock:cgstock@127.0.0.1:3307/cgstock
import { db } from "../../src/lib/db"
import { Prisma } from "@prisma/client"
import { normalizeNums } from "../../src/lib/raw-num"
import { buildBackupData } from "../../src/lib/backup"

async function main() {
  // 1) Query da página /stock (unit buckets)
  const unitRows = await db.$queryRaw<Record<string, unknown>[]>`
    WITH prod_totals AS (
      SELECT p.id, COALESCE(p.\`averageCost\`, 0) AS cost, p.\`minimumStock\`,
        UPPER(TRIM(COALESCE(u.code, 'UN'))) AS unit_code,
        TRIM(COALESCE(u.name, COALESCE(u.code, 'UN'))) AS unit_name,
        COALESCE(SUM(s.quantity), 0) AS qty,
        COALESCE(SUM(s.\`reservedQuantity\`), 0) AS res,
        COALESCE(SUM(s.quantity * COALESCE(p.\`averageCost\`, 0)), 0) AS erp_val
      FROM \`Product\` p
      LEFT JOIN \`ProductUnit\` u ON u.id = p.\`unitId\`
      LEFT JOIN \`Stock\` s ON s.\`productId\` = p.id
      GROUP BY p.id, u.code, u.name)
    SELECT unit_code AS \`unitCode\`, MAX(unit_name) AS \`unitName\`,
      COUNT(*) AS \`totalProducts\`,
      SUM(CASE WHEN qty > 0 THEN 1 ELSE 0 END) AS \`skusInStock\`,
      SUM(CASE WHEN qty = 0 THEN 1 ELSE 0 END) AS \`zeroStockCount\`,
      SUM(CASE WHEN qty > 0 AND \`minimumStock\` > 0 AND qty <= \`minimumStock\` THEN 1 ELSE 0 END) AS \`lowStockCount\`,
      COALESCE(SUM(qty), 0) AS \`physical\`, COALESCE(SUM(res), 0) AS \`reserved\`,
      COALESCE(SUM(qty * cost), 0) AS \`stockValue\`, COALESCE(SUM(erp_val), 0) AS \`erpValue\`
    FROM prod_totals GROUP BY unit_code`
  console.log("stock/buckets:", unitRows.map(normalizeNums))

  // 2) Query da página /stock (lista) com busca LIKE
  const pageRows = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT p.id, p.code, p.name, p.\`minimumStock\`, p.\`maximumStock\`,
      COALESCE(p.\`averageCost\`, 0) AS \`averageCost\`,
      c.name AS \`categoryName\`, u.code AS \`unitCode\`,
      MAX(w.name) AS \`warehouseName\`,
      COUNT(DISTINCT s.\`warehouseId\`) AS \`warehouseCount\`,
      COALESCE(SUM(s.quantity), 0) AS \`totalQuantity\`,
      COALESCE(SUM(s.\`reservedQuantity\`), 0) AS \`totalReserved\`,
      COALESCE(SUM(s.quantity * COALESCE(p.\`averageCost\`, 0)), 0) AS \`totalValue\`
    FROM \`Product\` p
    INNER JOIN \`ProductCategory\` c ON c.id = p.\`categoryId\`
    INNER JOIN \`ProductUnit\` u ON u.id = p.\`unitId\`
    LEFT JOIN \`Stock\` s ON s.\`productId\` = p.id
    LEFT JOIN \`Warehouse\` w ON w.id = s.\`warehouseId\`
    WHERE (p.name LIKE ${"%parafuso%"} OR p.code LIKE ${"%parafuso%"})
    GROUP BY p.id, c.name, u.code
    ORDER BY (p.name LIKE '!%') ASC, p.name ASC LIMIT 3`
  console.log("stock/lista(LIKE):", pageRows.map(normalizeNums).length, "linhas")

  // 3) Summary da página /products
  const summary = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT COUNT(DISTINCT p.id) AS \`totalCount\`,
      COALESCE(SUM(s.quantity), 0) AS \`totalItemsInStock\`,
      COALESCE(SUM(s.quantity * COALESCE(p.\`averageCost\`, 0)), 0) AS \`grandTotalValue\`
    FROM \`Product\` p LEFT JOIN \`Stock\` s ON s.\`productId\` = p.id`
  console.log("products/summary:", summary.map(normalizeNums))

  // 4) Chart do dashboard
  const chart = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT DATE_FORMAT(\`createdAt\`, '%Y-%m-%d') AS day, type, SUM(quantity) AS total
    FROM \`StockMovement\` GROUP BY 1, 2 ORDER BY 1 LIMIT 5`
  console.log("dashboard/chart:", chart.map(normalizeNums))

  // 5) Prisma client comum: relações, Json, Decimal, contains
  const product = await db.product.findFirst({ include: { unit: true, category: true, stocks: true } })
  console.log("prisma/relacoes:", product?.name.slice(0, 30), "| unit:", product?.unit.code, "| avgCost:", String(product?.averageCost))
  const search = await db.product.count({ where: { name: { contains: "parafuso" } } })
  console.log("prisma/contains(case-insensitive):", search)
  const audit = await db.auditLog.findFirst({ where: { metadata: { not: Prisma.AnyNull } } })
  console.log("prisma/Json:", audit ? JSON.stringify(audit.metadata).slice(0, 60) : "sem metadata")

  // 6) Escrita transacional + unique conflict path
  const w = await db.warehouse.findFirst()
  try {
    await db.$transaction(async (tx) => {
      await tx.productUnit.create({ data: { code: "__T__", name: "tmp" } })
      throw new Error("rollback intencional")
    })
  } catch (e) { if (!(e instanceof Error && e.message === "rollback intencional")) throw e }
  const stillThere = await db.productUnit.findFirst({ where: { code: "__T__" } })
  console.log("prisma/tx-rollback:", stillThere ? "FALHOU" : "OK")

  // 7) Export na engine nova (round-trip)
  const b = await buildBackupData()
  console.log("backup/export:", Object.keys(b.tables).length, "tabelas,", Object.keys(b.implicitTables).length, "implícitas")
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
