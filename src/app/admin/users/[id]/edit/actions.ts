"use server"

import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { validatePasswordStrength } from "@/lib/password-policy"
import { requireAdmin } from "@/lib/action-guard"
import { logAuditStrict } from "@/lib/audit"
import { Prisma } from "@prisma/client"

export async function editUserAction(prevState: { error?: string } | null, formData: FormData) {
  let session
  try {
    session = await requireAdmin()
  } catch {
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

  const warehouseIds = formData.getAll("warehouseIds") as string[]

  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: updateData
      })

      await tx.userWarehouseAccess.deleteMany({
        where: { userId: id, warehouseId: { notIn: warehouseIds } }
      })
      const existingAccesses = await tx.userWarehouseAccess.findMany({
        where: { userId: id },
        select: { warehouseId: true }
      })
      const existingWarehouseIds = new Set(existingAccesses.map(a => a.warehouseId))
      const toGrant = warehouseIds.filter(wid => !existingWarehouseIds.has(wid))

      if (toGrant.length > 0) {
        await tx.userWarehouseAccess.createMany({
          data: toGrant.map(wid => ({
            userId: id,
            warehouseId: wid,
            grantedById: session.userId
          })),
          skipDuplicates: true
        })

        await Promise.all(toGrant.map(wid =>
          logAuditStrict("WAREHOUSE_ACCESS_GRANTED", "User", id, { warehouseId: wid }, session.userId, tx)
        ))
      }

      const toRevoke = existingAccesses.map(a => a.warehouseId).filter(wid => !warehouseIds.includes(wid))
      await Promise.all(toRevoke.map(wid =>
        logAuditStrict("WAREHOUSE_ACCESS_REVOKED", "User", id, { warehouseId: wid }, session.userId, tx)
      ))

      await logAuditStrict("USER_UPDATED", "User", id, {
        name,
        email,
        roleIds,
        worksiteIds,
        warehouseIds,
        passwordChanged: !!password,
        mustChangePassword: updateData.mustChangePassword ?? null
      }, session.userId, tx)
    })
  } catch (error) {
    console.error("Erro ao editar usuário:", error)
    return { error: "Erro interno ao editar usuário." }
  }

  revalidatePath("/admin/users")
  redirect("/admin/users")
}
