"use server"

import { db } from "@/lib/db"
import { getSession, createSession } from "@/lib/auth"
import { validatePasswordStrength } from "@/lib/password-policy"
import bcrypt from "bcryptjs"

export async function changePasswordAction(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: "Não autorizado." }

  const currentPassword = formData.get("currentPassword") as string
  const newPassword = formData.get("newPassword") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!currentPassword || !newPassword || !confirmPassword) {
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

  const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!passwordMatch) {
    return { error: "Senha atual incorreta." }
  }

  const newHash = await bcrypt.hash(newPassword, 10)

  // Incrementa a versão de sessão: invalida todas as outras sessões ativas
  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
      sessionVersion: { increment: 1 }
    },
    include: { roles: true }
  })

  // Renew session to remove mustChangePassword flag
  await createSession(updatedUser.id, updatedUser.name, updatedUser.email!, updatedUser.roles.map(r => r.name), false, updatedUser.sessionVersion)

  return { success: true }
}
