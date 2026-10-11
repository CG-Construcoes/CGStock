import { cache } from "react"
import { redirect } from "next/navigation"
import { db } from "./db"
import { getValidatedSession, type SessionPayload } from "./auth"
import { getUserSecurityContext, type UserSecurityContext } from "./user-context"
import type { PermissionKey } from "./permissions"

/**
 * Data Access Layer (DAL): ponto centralizado de verificação de sessão e
 * autorização no servidor. O proxy (src/proxy.ts) faz apenas verificações
 * otimistas; as decisões de segurança reais acontecem aqui, perto dos dados.
 */

export type AuthUser = {
  session: SessionPayload
  ctx: UserSecurityContext
}

export class PasswordChangeRequiredError extends Error {
  constructor() {
    super("É obrigatório definir uma nova senha para continuar")
    this.name = "PasswordChangeRequiredError"
  }
}

/**
 * Retorna o usuário autenticado e validado no banco, ou null.
 * Dedup por request via React cache.
 */
export const verifyUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getValidatedSession()
  if (!session) return null
  const ctx = await getUserSecurityContext(session.userId)
  if (!ctx) return null
  return { session, ctx }
})

/**
 * Exige sessão válida. Por padrão, usuários com troca de senha pendente são
 * bloqueados em qualquer ação que não seja a própria troca de senha
 * (usar allowPendingPasswordChange: true apenas nela e no login/logout).
 */
export async function requireUser(opts?: { allowPendingPasswordChange?: boolean }): Promise<AuthUser> {
  const user = await verifyUser()
  if (!user) throw new Error("Não autenticado: faça login para continuar.")
  if (user.ctx.mustChangePassword && !opts?.allowPendingPasswordChange) {
    throw new PasswordChangeRequiredError()
  }
  return user
}

/** Versão para páginas: redireciona em vez de lançar erro. */
export async function requirePageUser(): Promise<AuthUser> {
  const user = await verifyUser()
  if (!user) redirect("/login")
  if (user.ctx.mustChangePassword) redirect("/change-password")
  return user
}

export async function hasAnyRole(user: AuthUser, roles: string[]): Promise<boolean> {
  return roles.some(r => user.ctx.roleNames.includes(r))
}

export async function hasAnyPermissionKey(user: AuthUser, keys: PermissionKey[]): Promise<boolean> {
  if (user.ctx.roleNames.includes("ADMIN")) return true
  return keys.some(k => user.ctx.permissionKeys.has(k))
}

/**
 * Exige que o usuário possua pelo menos uma das permissões. ADMIN passa sempre.
 * Lança erro para uso em Server Actions / Route Handlers.
 */
export async function requireAnyPermission(...keys: PermissionKey[]): Promise<AuthUser> {
  const user = await requireUser()
  if (user.ctx.roleNames.includes("ADMIN")) return user
  if (!keys.some(k => user.ctx.permissionKeys.has(k))) {
    throw new Error("Não autorizado: você não possui permissão para executar esta ação.")
  }
  return user
}

/** Versão para páginas: redireciona para /unauthorized. */
export async function requirePageAnyPermission(...keys: PermissionKey[]): Promise<AuthUser> {
  const user = await requirePageUser()
  if (user.ctx.roleNames.includes("ADMIN")) return user
  if (!keys.some(k => user.ctx.permissionKeys.has(k))) {
    redirect("/unauthorized")
  }
  return user
}

// ============================================================
// Acesso por almoxarifado
// ============================================================

const ALL_WAREHOUSES = Symbol("ALL_WAREHOUSES")
type WarehouseScope = typeof ALL_WAREHOUSES | string[]

/**
 * IDs dos almoxarifados aos quais o usuário tem acesso, ou o símbolo
 * ALL_WAREHOUSES quando o usuário é ADMIN (sem restrição).
 * Dedup por request.
 */
export const getWarehouseScope = cache(async (userId: string): Promise<WarehouseScope> => {
  const ctx = await getUserSecurityContext(userId)
  if (!ctx) return []
  if (ctx.roleNames.includes("ADMIN")) return ALL_WAREHOUSES

  const accesses = await db.userWarehouseAccess.findMany({
    where: { userId },
    select: { warehouseId: true },
  })
  return accesses.map(a => a.warehouseId)
})

export async function getAccessibleWarehouseIds(userId?: string): Promise<string[] | null> {
  const user = userId
    ? { ctx: await getUserSecurityContext(userId), id: userId }
    : await verifyUser()
  if (!user) return []
  const id = "session" in user ? user.session.userId : (user as { id: string }).id
  const scope = await getWarehouseScope(id)
  return scope === ALL_WAREHOUSES ? null : scope
}

/** Lança erro se o usuário não tiver acesso ao almoxarifado. */
export async function assertWarehouseAccess(warehouseId: string, userId?: string) {
  const user = userId ?? (await requireUser()).session.userId
  const scope = await getWarehouseScope(user)
  if (scope === ALL_WAREHOUSES) return
  if (!scope.includes(warehouseId)) {
    throw new Error("Não autorizado: você não possui acesso a este almoxarifado.")
  }
}

/**
 * Cláusula `where` do Prisma para restringir consultas a campos `warehouseId`.
 * Retorna o objeto de filtro ou undefined quando não há restrição (ADMIN).
 */
export async function warehouseIdFilter(userId?: string): Promise<{ warehouseId: { in: string[] } } | undefined> {
  const user = userId ?? (await requireUser()).session.userId
  const scope = await getWarehouseScope(user)
  if (scope === ALL_WAREHOUSES) return undefined
  return { warehouseId: { in: scope } }
}

/** Variante para modelos sem warehouseId direto (Stock possui, então mantido como convenção uso direto). */
export async function warehouseScopeIds(userId?: string): Promise<string[] | null> {
  const user = userId ?? (await requireUser()).session.userId
  const scope = await getWarehouseScope(user)
  return scope === ALL_WAREHOUSES ? null : scope
}
