"use server"

import { db } from "@/lib/db"
import { createSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { headers } from "next/headers"
import bcrypt from "bcryptjs"

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_WINDOW_MINUTES = 15

async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers()
    return headersList.get('x-forwarded-for')?.split(',')[0].trim()
      || headersList.get('x-real-ip')
      || ""
  } catch {
    return ""
  }
}

export async function loginAction(prevState: unknown, formData: FormData) {
  const email = (formData.get("email") as string || "").trim().toLowerCase()
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Por favor, preencha todos os campos." }
  }

  const ip = await getClientIp()

  // Rate limiting: bloqueia após muitas falhas recentes
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000)
  const recentFailures = await db.loginAttempt.count({
    where: { email, success: false, createdAt: { gte: windowStart } }
  })

  if (recentFailures >= MAX_FAILED_ATTEMPTS) {
    return { error: `Muitas tentativas de login. Tente novamente em ${LOCKOUT_WINDOW_MINUTES} minutos.` }
  }

  const user = await db.user.findUnique({
    where: { email },
    include: { roles: true }
  })

  const passwordMatch = user ? await bcrypt.compare(password, user.passwordHash) : false

  const recordAttempt = (success: boolean) =>
    db.loginAttempt.create({ data: { email, ip, success } })

  if (!user || !passwordMatch) {
    await recordAttempt(false)
    if (user) {
      await logAudit("LOGIN_FAILED", "User", user.id, { email }, user.id)
    }
    return { error: "Credenciais inválidas." }
  }

  if (user.status !== "ACTIVE") {
    return { error: "Seu usuário está inativo." }
  }

  await recordAttempt(true)
  await logAudit("LOGIN_SUCCESS", "User", user.id, { email }, user.id)

  await createSession(
    user.id,
    user.name,
    user.email,
    user.roles.map(r => r.name),
    user.mustChangePassword,
    user.sessionVersion
  )

  return { success: true }
}
