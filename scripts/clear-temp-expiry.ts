// Desbloqueia usuarios que ja definiram senha definitiva mas ficaram com
// temporaryPasswordExpiresAt pendente (bug corrigido no commit 3d1197c).
// Uso: npx tsx scripts/clear-temp-expiry.ts [email]   (sem email = todos os afetados)
import { readFileSync } from "node:fs"

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

async function main() {
  const { db } = await import("../src/lib/db")
  const email = process.argv[2]

  const where = {
    mustChangePassword: false,
    temporaryPasswordExpiresAt: { not: null },
    ...(email ? { email } : {}),
  }

  const affected = await db.user.findMany({
    where,
    select: { id: true, name: true, email: true, temporaryPasswordExpiresAt: true },
  })
  console.log("Usuarios com expiracao temporaria pendente:", affected.map(u => ({ name: u.name, email: u.email, expirouEm: u.temporaryPasswordExpiresAt })))

  if (affected.length === 0) {
    console.log("Nenhum usuario para ajustar.")
    return
  }

  const result = await db.user.updateMany({
    where: { id: { in: affected.map(u => u.id) } },
    data: { temporaryPasswordExpiresAt: null },
  })
  console.log(`OK — ${result.count} usuario(s) desbloqueado(s). Senhas definitivas voltam a valer imediatamente.`)
  await db.$disconnect()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
