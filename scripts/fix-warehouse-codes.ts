/**
 * Ajusta os códigos dos almoxarifados para o Centro de Negócio do Informakon (AAA.BB.CCCC)
 * e preenche o engenheiro responsável de cada um.
 * Uso: npx tsx scripts/fix-warehouse-codes.ts          (simulação, não grava)
 *      npx tsx scripts/fix-warehouse-codes.ts --apply  (grava no banco do DATABASE_URL)
 */
import { PrismaClient } from "@prisma/client"

const RENAMES: Record<string, string> = {
  "ALM-CENTRAL": "CGC.01.0114", // Cg - Estoque Almoxarifado Central
  "ALM-MAHAY": "CVP.01.0008",   // Mahay Residence - Obra
  "PSC-01-0011": "PSC.01.0011", // Ousy - Obra
}

// Chave: código final (já no padrão Informakon)
const ENGINEERS: Record<string, { engineerName: string; engineerEmail: string }> = {
  "CCJ.01.0001": { engineerName: "Vinicius Ascencio", engineerEmail: "viniciusascencio@cgconstrucoes.com" }, // Brasília (Metrô DF)
  "PSC.01.0011": { engineerName: "Sérgio Gonçalves", engineerEmail: "sergiogoncalves@cgconstrucoes.com" },  // Ousy
  "CVP.01.0008": { engineerName: "Maria Inês", engineerEmail: "mariaines@cgconstrucoes.com" },              // Mahay
  "CGC.01.0114": { engineerName: "Marcos Fonseca", engineerEmail: "marcos@cgconstrucoes.com" },             // Almoxarifado Central
}

const db = new PrismaClient()
const apply = process.argv.includes("--apply")

async function main() {
  const warehouses = await db.warehouse.findMany({ select: { id: true, code: true, name: true } })
  const byCode = new Map(warehouses.map(w => [w.code.toUpperCase(), w]))

  for (const [from, to] of Object.entries(RENAMES)) {
    const wh = byCode.get(from)
    if (!wh) { console.log(`- ${from}: não encontrado (já ajustado?)`); continue }
    const clash = byCode.get(to)
    if (clash && clash.id !== wh.id) { console.log(`! ${from} → ${to}: código já usado por "${clash.name}", pulando`); continue }
    console.log(`${apply ? "✔" : "·"} ${wh.name}: ${from} → ${to}`)
    if (apply) await db.warehouse.update({ where: { id: wh.id }, data: { code: to } })
  }

  for (const [code, engineer] of Object.entries(ENGINEERS)) {
    const wh = await db.warehouse.findUnique({ where: { code }, select: { id: true, name: true } })
      ?? (apply ? null : warehouses.find(w => RENAMES[w.code.toUpperCase()] === code) ?? null)
    if (!wh) { console.log(`- engenheiro ${code}: almoxarifado não encontrado`); continue }
    console.log(`${apply ? "✔" : "·"} ${wh.name}: engenheiro ${engineer.engineerName} <${engineer.engineerEmail}>`)
    if (apply) await db.warehouse.update({ where: { id: wh.id }, data: engineer })
  }
  if (!apply) console.log("\nSimulação. Rode com --apply para gravar.")
}

main().finally(() => db.$disconnect())
