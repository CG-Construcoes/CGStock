"use server"

import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { validatePasswordStrength } from "@/lib/password-policy"
import { Prisma } from "@prisma/client"

export async function editUserAction(prevState: { error?: string } | null, formData: FormData) {
  const session = await getSession()
  if (!session || !session.roles?.includes("ADMIN")) {
    return { error: "Sem permissão. Apenas administradores podem editar usuários." }
  }

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const roleIds = formData.getAll("roleIds") as string[]
  const worksiteIds = formData.getAll("worksiteIds") as string[]

  if (!id || !name || !email || roleIds.length === 0) {
    return { error: "Por favor, preencha todos os campos obrigatórios e selecione pelo menos um perfil." }
  }

  // Verificar se o email já está em uso por outro usuário
  const existing = await db.user.findUnique({ where: { email } })
  if (existing && existing.id !== id) {
    return { error: "Este e-mail já está em uso por outro usuário." }
  }

  if (password) {
    const passwordError = validatePasswordStrength(password)
    if (passwordError) {
      return { error: passwordError }
    }
  }

  const updateData: Prisma.UserUpdateInput = {
    name,
    email,
    roles: {
      set: roleIds.map(roleId => ({ id: roleId }))
    },
    worksiteAccesses: {
      deleteMany: {},
      create: worksiteIds.map(wid => ({
        worksiteId: wid,
        canViewStock: true,
        canRequestMaterial: true,
        canUseQuickIssue: true
      }))
    },
    // Perfis alterados: invalida sessões antigas que carregam roles no token
    sessionVersion: { increment: 1 }
  }

  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 10)
    updateData.mustChangePassword = formData.get("mustChangePassword") === "true"
  }

  try {
    await db.user.update({
      where: { id },
      data: updateData
    })
  } catch (error) {
    console.error("Erro ao editar usuário:", error)
    return { error: "Erro interno ao editar usuário." }
  }

  revalidatePath("/admin/users")
  redirect("/admin/users")
}
