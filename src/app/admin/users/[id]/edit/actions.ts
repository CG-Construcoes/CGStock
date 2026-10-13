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
  const accessMode = String(formData.get("warehouseAccessMode"))
  const warehouseIds = [...new Set(formData.getAll("warehouseIds") as string[])]

  if (!['ALL', 'SELECTED', 'NONE'].includes(String(accessMode))) {
    return { error: "Selecione um tipo de acesso aos almoxarifados." }
  }
  if (accessMode === 'SELECTED' && !warehouseIds.length) {
    return { error: "Selecione ao menos um almoxarifado ou escolha Nenhum." }
  }
  if (accessMode === 'SELECTED') {
    const validCount = await db.warehouse.count({ where: { id: { in: warehouseIds } } })
    if (validCount !== warehouseIds.length) return { error: "A seleção contém um almoxarifado inválido." }
  }

  if (!id || !name || !email || roleIds.length === 0) {
    return { error: "Por favor, preencha todos os campos obrigatórios e selecione pelo menos um perfil." }
  }

  // Verificar se o email já está em uso por outro usuário
  const [existing, currentUser] = await Promise.all([
    db.user.findUnique({ where: { email } }),
    db.user.findUnique({ where: { id }, select: { roles: { select: { id: true } }, worksiteAccesses: { select: { worksiteId: true } } } })
  ])
  if (!currentUser) return { error: "Usuário não encontrado." }
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
    allWarehouseAccess: accessMode === 'ALL',
    // Perfis alterados: invalida sessões antigas que carregam roles no token
    sessionVersion: password || currentUser.roles.length !== roleIds.length || currentUser.roles.some(role => !roleIds.includes(role.id))
      ? { increment: 1 } : undefined
  }

  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 10)
    updateData.mustChangePassword = formData.get("mustChangePassword") === "true"
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: updateData
      })
      const previousWorksites = new Set(currentUser.worksiteAccesses.map(access => access.worksiteId))
      const nextWorksites = new Set(worksiteIds)
      await tx.userWorksiteAccess.deleteMany({ where: { userId: id, worksiteId: { notIn: [...nextWorksites] } } })
      if ([...nextWorksites].some(worksiteId => !previousWorksites.has(worksiteId))) {
        await tx.userWorksiteAccess.createMany({
          data: [...nextWorksites].filter(worksiteId => !previousWorksites.has(worksiteId)).map(worksiteId => ({
            userId: id, worksiteId, canViewStock: true, canRequestMaterial: true, canUseQuickIssue: true
          }))
        })
      }

      const existingAccesses = await tx.userWarehouseAccess.findMany({
        where: { userId: id },
        select: { warehouseId: true }
      })
      const existingWarehouseIds = new Set(existingAccesses.map(a => a.warehouseId))
      const toGrant = accessMode === 'SELECTED' ? warehouseIds.filter(wid => !existingWarehouseIds.has(wid)) : []
      const toRevoke = accessMode === 'ALL' ? [] : existingAccesses.map(a => a.warehouseId).filter(wid => accessMode === 'NONE' || !warehouseIds.includes(wid))

      if (toRevoke.length) await tx.userWarehouseAccess.deleteMany({ where: { userId: id, warehouseId: { in: toRevoke } } })
      if (toGrant.length) {
        await tx.userWarehouseAccess.createMany({
          data: toGrant.map(wid => ({ userId: id, warehouseId: wid, grantedById: session.userId })),
          skipDuplicates: true
        })
      }
      for (const wid of toGrant) await logAuditStrict("WAREHOUSE_ACCESS_GRANTED", "User", id, { warehouseId: wid }, session.userId, tx)
      for (const wid of toRevoke) await logAuditStrict("WAREHOUSE_ACCESS_REVOKED", "User", id, { warehouseId: wid }, session.userId, tx)

      await logAuditStrict("USER_UPDATED", "User", id, {
        name,
        email,
        roleIds,
        worksiteIds,
        warehouseIds: accessMode === 'SELECTED' ? warehouseIds : undefined,
        warehouseAccessMode: accessMode,
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
