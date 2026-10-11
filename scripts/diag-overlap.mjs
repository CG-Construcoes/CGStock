// Diagnóstico somente-leitura: sobreposição de códigos produto/arquivo x banco (Etapa 0)
import fs from 'fs'
import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'

for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

const p = new PrismaClient()

const files = {
  CENTRAL: 'ESTOQUE ALMOXARIFADO CENTRAL.xlsx',
  BRASILIA: 'ESTOQUE BRASILIA.xlsx',
  'OUSY-SP': 'ESTQOUE OUSY SP.xlsx',
}

const dbProducts = await p.product.findMany({ select: { code: true, name: true, unit: { select: { code: true } } } })
const dbByCode = new Map(dbProducts.map(d => [d.code, d]))

const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

for (const [key, file] of Object.entries(files)) {
  const rows = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(file), { type: 'buffer' }).Sheets.Pagina01, { defval: null })
    .filter(r => r['Material'])
  let match = 0, nameDiff = 0, unitDiff = 0
  const nameDiffEx = []
  for (const r of rows) {
    const d = dbByCode.get(String(r['Material']))
    if (!d) continue
    match++
    if (norm(d.name) !== norm(r['Especificação'])) {
      nameDiff++
      if (nameDiffEx.length < 5) nameDiffEx.push([r['Material'], d.name.slice(0, 60), String(r['Especificação']).slice(0, 60)])
    }
    if (d.unit.code !== String(r['Unidade'])) unitDiff++
  }
  console.log(key, JSON.stringify({
    fileRows: rows.length,
    jaNoBanco: match,
    novos: rows.length - match,
    nameDiferente: nameDiff,
    unitDiferente: unitDiff,
    nameDiffEx,
  }))
}

const perms = await p.permission.findMany({ select: { key: true }, orderBy: { key: 'asc' } })
console.log('PERMISSIONS', JSON.stringify(perms.map(x => x.key)))

const geralStocks = await p.stock.findMany({
  where: { location: { code: 'GERAL' } },
  select: { quantity: true, product: { select: { code: true } } },
  take: 3,
})
console.log('MAHAY_GERAL_STOCK_SAMPLE', JSON.stringify(geralStocks))

await p.$disconnect()
