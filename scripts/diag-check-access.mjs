import fs from 'fs'
import { PrismaClient } from '@prisma/client'

for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

const p = new PrismaClient()
console.log('userWarehouseAccess rows:', await p.userWarehouseAccess.count())
console.log(JSON.stringify(await p.userWarehouseAccess.findMany({ take: 10, select: { userId: true, warehouseId: true } })))
await p.$disconnect()
