"use server"

import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { createSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { validatePasswordStrength } from "@/lib/password-policy"
import { verifyPasswordResetToken } from "@/lib/password-reset"

export async function resetPasswordWithTokenAction(_prev: unknown, formData: FormData) {
  const token = String(formData.get("token") || "")
  const newPassword = String(formData.get("newPassword") || "")
  const confirmPassword = String(formData.get("confirmPassword") || "")

  if (!newPassword || !confirmPassword) return { error: "Por favor, preencha todos os campos." }
  if (newPassword !== confirmPassword) return { error: "As senhas não coincidem." }
  const passwordError = validatePasswordStrength(newPassword)
  if (passwordError) return { error: passwordError }

  const user = await verifyPasswordResetToken(token)
  if (!user) return { error: "Este link é inválido, expirou ou já foi utilizado. Solicite um novo.", expired: true }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      sessionVersion: { increment: 1 },
    },
    include: { roles: true },
  })

  await logAudit("PASSWORD_RESET_COMPLETED", "User", user.id, { via: "email-link" }, user.id)
  await createSession(updated.id, updated.name, updated.email!, updated.roles.map(r => r.name), false, updated.sessionVersion)

  return { success: true }
}
