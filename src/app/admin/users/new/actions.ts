"use server"

import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { validatePasswordStrength } from "@/lib/password-policy"
import { requireActionPermission } from "@/lib/action-guard"
import { logAuditStrict } from "@/lib/audit"

export async function createUserAction(prevState: { error?: string } | null, formData: FormData) {
  let session
  try {
    session = await requireActionPermission("USER_MANAGE")
  } catch {
    return { error: "Sem permissão para cadastrar usuários." }
  }

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const roleIds = formData.getAll("roleIds") as string[]
  const accessMode = String(formData.get("warehouseAccessMode"))
  const warehouseIds = [...new Set(formData.getAll("warehouseIds") as string[])]
  if (!['NONE', 'SELECTED', 'ALL'].includes(String(accessMode))) return { error: "Selecione um tipo de acesso aos almoxarifados." }
  if (accessMode === 'SELECTED') {
    if (!warehouseIds.length) return { error: "Selecione ao menos um almoxarifado." }
    const count = await db.warehouse.count({ where: { id: { in: warehouseIds }, status: 'ACTIVE' } })
    if (count !== warehouseIds.length) return { error: "Almoxarifado inválido ou inativo." }
  }

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
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          roles: {
            connect: roleIds.map(id => ({ id }))
          },
          status: "ACTIVE",
          loginEnabled: true,
          allWarehouseAccess: accessMode === 'ALL',
          warehouseAccesses: accessMode === 'SELECTED' ? { create: warehouseIds.map(warehouseId => ({ warehouseId, grantedById: session.userId })) } : undefined,
          mustChangePassword: formData.get("mustChangePassword") === "true"
        }
      })
      // Nunca registrar senha (nem em hash) nos metadados de auditoria
      await logAuditStrict("USER_CREATED", "User", user.id, {
        name: user.name,
        email: user.email,
        roleIds,
        warehouseAccessMode: accessMode,
        warehouseIds: accessMode === 'SELECTED' ? warehouseIds : undefined,
        mustChangePassword: user.mustChangePassword
      }, session.userId, tx)
    })
  } catch (error) {
    console.error("Erro ao criar usuário:", error)
    return { error: "Erro interno ao criar usuário." }
  }

  revalidatePath("/admin/users")
  redirect("/admin/users")
}
