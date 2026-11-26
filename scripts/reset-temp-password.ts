// Reseta a senha de um usuário para uma temporária (bcrypt 10, igual ao app).
// Uso: npx tsx scripts/reset-temp-password.ts <email> [senha]
import { readFileSync } from "node:fs"
import bcrypt from "bcryptjs"

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

async function main() {
  const { db } = await import("../src/lib/db")
  const email = process.argv[2]
  if (!email) throw new Error("Informe o e-mail")
  const temp = process.argv[3] ?? `Temp@${Math.random().toString(36).slice(2, 8)}!`

  const user = await db.user.findFirst({ where: { email: { equals: email } } })
  if (!user) throw new Error(`Usuário ${email} não encontrado`)
  console.log("Antes:", { status: user.status, loginEnabled: user.loginEnabled, tempExpira: user.temporaryPasswordExpiresAt })

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(temp, 10),
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      loginEnabled: true,
      status: "ACTIVE",
      sessionVersion: { increment: 1 },
    },
  })
  console.log(`OK — senha temporária (válida por 72h): ${temp}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message ?? e); process.exit(1) })
