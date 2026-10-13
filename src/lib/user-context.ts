import { cache } from "react"
import { db } from "./db"

export type UserSecurityContext = {
  status: string
  sessionVersion: number
  roleNames: string[]
  permissionKeys: Set<string>
  mustChangePassword: boolean
  allWarehouseAccess: boolean
}

/**
 * Contexto de segurança do usuário (status, versão de sessão, perfis e
 * permissões). Dedup por request via React cache: múltiplas chamadas na
 * mesma renderização custam apenas uma query.
 */
export const getUserSecurityContext = cache(async (userId: string): Promise<UserSecurityContext | null> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  })

  if (!user) return null

  return {
    status: user.status,
    sessionVersion: user.sessionVersion,
    roleNames: user.roles.map(r => r.name),
    permissionKeys: new Set(
      user.roles.flatMap(r => r.permissions.map(rp => rp.permission.key))
    ),
    mustChangePassword: user.mustChangePassword,
    allWarehouseAccess: user.allWarehouseAccess
  }
})
