"use server"

import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { validatePasswordStrength } from "@/lib/password-policy"

export async function createUserAction(prevState: { error?: string } | null, formData: FormData) {
  const session = await getSession()
  if (!session || !session.roles?.includes("ADMIN")) {
    return { error: "Sem permissão. Apenas administradores podem criar usuários." }
  }

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const roleIds = formData.getAll("roleIds") as string[]

  if (!name || !email || !password || roleIds.length === 0) {
    return { error: "Por favor, preencha todos os campos e selecione pelo menos um perfil." }
  }

  // Verificar e-mail
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return { error: "Este e-mail já está em uso." }
  }

  const passwordError = validatePasswordStrength(password)
  if (passwordError) {
    return { error: passwordError }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  try {
    await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        roles: {
          connect: roleIds.map(id => ({ id }))
        },
        status: "ACTIVE",
        mustChangePassword: formData.get("mustChangePassword") === "true"
      }
    })
  } catch (error) {
    console.error("Erro ao criar usuário:", error)
    return { error: "Erro interno ao criar usuário." }
  }

  revalidatePath("/admin/users")
  redirect("/admin/users")
}
