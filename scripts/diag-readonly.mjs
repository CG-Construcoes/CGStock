// Diagnóstico somente-leitura do banco (Etapa 0). Executar: node scripts/diag-readonly.mjs
import fs from 'fs'
import { PrismaClient } from '@prisma/client'

for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

const p = new PrismaClient()

const q = {
  product: await p.product.count(),
  productActive: await p.product.count({ where: { status: 'ACTIVE' } }),
  warehouse: await p.warehouse.count(),
  location: await p.warehouseLocation.count(),
  stock: await p.stock.count(),
  movement: await p.stockMovement.count(),
  userActive: await p.user.count({ where: { status: 'ACTIVE' } }),
  userTempPending: await p.user.count({ where: { mustChangePassword: true } }),
  worksite: await p.worksite.count(),
  worksiteAccess: await p.userWorksiteAccess.count(),
  role: await p.role.count(),
  permission: await p.permission.count(),
}
console.log('COUNTS', JSON.stringify(q))

console.log('WAREHOUSES', JSON.stringify(
  await p.warehouse.findMany({
    select: {
      id: true, code: true, name: true, status: true, worksiteId: true,
      _count: { select: { stocks: true, movements: true, locations: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
))

console.log('MOV_BY_REFERENCE', JSON.stringify(
  await p.stockMovement.groupBy({ by: ['referenceType'], _count: true })
))
console.log('MOV_BY_TYPE', JSON.stringify(
  await p.stockMovement.groupBy({ by: ['type'], _count: true })
))
console.log('LOCATIONS', JSON.stringify(
  await p.warehouseLocation.findMany({
    select: { code: true, name: true, warehouse: { select: { code: true } } },
  })
))
console.log('ROLES', JSON.stringify(
  await p.role.findMany({ select: { name: true, _count: { select: { users: true } } } })
))
console.log('PRODUCT_CODE_SAMPLE', JSON.stringify(
  await p.product.findMany({ select: { code: true }, take: 5 })
))

const cols = await p.$queryRawUnsafe(
  "SELECT column_name FROM information_schema.columns WHERE table_name='User' ORDER BY ordinal_position"
)
console.log('USER_COLUMNS', JSON.stringify(cols.map(r => r.column_name)))

await p.$disconnect()
