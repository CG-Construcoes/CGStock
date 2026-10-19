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

const TTL_MS = 30_000
const memoryCache = new Map<string, { value: UserSecurityContext | null; expiresAt: number }>()

export function invalidateUserSecurityCache(userId?: string) {
  if (userId) {
    memoryCache.delete(userId)
  } else {
    memoryCache.clear()
  }
}

/**
 * Contexto de segurança do usuário (status, versão de sessão, perfis e
 * permissões). Dedup por request via React cache e cache curto em memória
 * para evitar round-trips repetidos a cada navegação.
 */
export const getUserSecurityContext = cache(async (userId: string): Promise<UserSecurityContext | null> => {
  const isTest = process.env.NODE_ENV === "test"
  if (!isTest) {
    const cached = memoryCache.get(userId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      sessionVersion: true,
      mustChangePassword: true,
      allWarehouseAccess: true,
      roles: {
        select: {
          name: true,
          permissions: {
            select: {
              permission: {
                select: {
                  key: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!user) {
    if (!isTest) memoryCache.set(userId, { value: null, expiresAt: Date.now() + 5_000 })
    return null
  }

  const ctx: UserSecurityContext = {
    status: user.status,
    sessionVersion: user.sessionVersion,
    roleNames: user.roles.map(r => r.name),
    permissionKeys: new Set(
      user.roles.flatMap(r => r.permissions.map(rp => rp.permission.key))
    ),
    mustChangePassword: user.mustChangePassword,
    allWarehouseAccess: user.allWarehouseAccess
  }

  if (!isTest) {
    memoryCache.set(userId, { value: ctx, expiresAt: Date.now() + TTL_MS })
  }

  return ctx
})
