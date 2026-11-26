// Consulta temporaria (somente leitura) do estado de login de um usuario.
import { readFileSync } from "node:fs"
import bcrypt from "bcryptjs"

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

async function main() {
  const { db } = await import("../src/lib/db")
  const term = process.argv[2] ?? "hudson"
  const password = process.argv[3]
  const users = await db.user.findMany({
    where: { OR: [{ name: { contains: term } }, { email: { contains: term } }] },
    select: {
      id: true, name: true, email: true, status: true, loginEnabled: true,
      mustChangePassword: true, temporaryPasswordExpiresAt: true, passwordHash: true,
    },
  })
  for (const u of users) {
    const { passwordHash, ...rest } = u
    console.log({
      ...rest,
      passwordMatch: password && u.passwordHash ? await bcrypt.compare(password, u.passwordHash) : undefined,
    })
  }
  await db.$disconnect()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
