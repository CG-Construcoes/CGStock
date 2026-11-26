"use server"

import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { sendPasswordResetEmail } from "@/lib/password-reset"

const MAX_REQUESTS = 3
const WINDOW_MINUTES = 15
const GENERIC_SUCCESS = "Se o usuário existir e estiver ativo, enviaremos um link de redefinição para o e-mail cadastrado."

export async function requestPasswordResetAction(_prev: unknown, formData: FormData) {
  const identifier = String(formData.get("email") || "").trim().toLowerCase()
  if (!identifier) return { error: "Informe seu e-mail ou CPF." }

  // Reaproveita LoginAttempt como contador de solicitações (chave prefixada)
  const key = `reset:${identifier}`
  const recent = await db.loginAttempt.count({
    where: { email: key, createdAt: { gte: new Date(Date.now() - WINDOW_MINUTES * 60 * 1000) } },
  })
  if (recent >= MAX_REQUESTS) {
    return { error: `Muitas solicitações. Aguarde ${WINDOW_MINUTES} minutos e tente novamente.` }
  }
  await db.loginAttempt.create({ data: { email: key, success: false } })

  const digits = identifier.replace(/\D/g, "")
  const user = await db.user.findFirst({
    where: {
      loginEnabled: true,
      status: "ACTIVE",
      email: { not: null },
      OR: identifier.includes("@")
        ? [{ email: identifier }]
        : [
            ...(digits.length >= 11 ? [{ document: digits }] : []),
            ...(digits ? [{ employeeCode: digits }] : []),
            { email: identifier },
          ],
    },
  })

  if (user?.email) {
    try {
      await sendPasswordResetEmail({ ...user, email: user.email })
      await logAudit("PASSWORD_RESET_REQUESTED", "User", user.id, { via: "self-service" }, user.id)
    } catch (error) {
      console.error("Falha ao enviar e-mail de redefinição:", error)
      return { error: "Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos." }
    }
  }

  return { success: GENERIC_SUCCESS }
}
