"use server"

import { db } from "@/lib/db"
import { requireActionPermission } from "@/lib/action-guard"
import { logAuditStrict } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export async function togglePermission(roleId: string, permissionId: string, enable: boolean) {
  const session = await requireActionPermission("CONFIG_MANAGE")

  const role = await db.role.findUnique({ where: { id: roleId } })
  if (!role) throw new Error("Perfil não encontrado")

  if (role.name === "ADMIN") {
    throw new Error("Não é possível alterar as permissões do perfil ADMIN, pois ele tem acesso total por padrão.")
  }

  if (enable) {
    await db.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId
        }
      },
      update: {},
      create: {
        roleId,
        permissionId
      }
    })
  } else {
    await db.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId
      }
    })
  }

  await logAuditStrict("PERMISSION_CHANGED", "RolePermission", roleId, { permissionId, enable }, session.userId)

  revalidatePath("/admin/permissions")
  return { success: true }
}
