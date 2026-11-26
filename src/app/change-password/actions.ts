"use server"

import { db } from "@/lib/db"
import { getSession, createSession } from "@/lib/auth"
import { validatePasswordStrength } from "@/lib/password-policy"
import bcrypt from "bcryptjs"

export async function changePasswordAction(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: "Não autorizado." }

  const newPassword = formData.get("newPassword") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!newPassword || !confirmPassword) {
    return { error: "Por favor, preencha todos os campos." }
  }

  if (newPassword !== confirmPassword) {
    return { error: "As novas senhas não coincidem." }
  }

  const passwordError = validatePasswordStrength(newPassword)
  if (passwordError) {
    return { error: passwordError }
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { roles: true }
  })

  if (!user || !user.passwordHash || !user.email) {
    return { error: "Usuário sem credenciais de acesso." }
  }

  // O usuário acabou de se autenticar com a senha temporária: não pedimos ela de novo.
  // A troca sem senha atual só vale para quem está obrigado a trocar e com sessão vigente.
  if (!user.mustChangePassword || user.status !== "ACTIVE" || (session.sessionVersion !== undefined && session.sessionVersion !== user.sessionVersion)) {
    return { error: "Sessão inválida para troca de senha. Faça login novamente." }
  }

  const newHash = await bcrypt.hash(newPassword, 10)

  // Incrementa a versão de sessão: invalida todas as outras sessões ativas
  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      sessionVersion: { increment: 1 }
    },
    include: { roles: true }
  })

  // Renew session to remove mustChangePassword flag
  await createSession(updatedUser.id, updatedUser.name, updatedUser.email!, updatedUser.roles.map(r => r.name), false, updatedUser.sessionVersion)

  return { success: true }
}
