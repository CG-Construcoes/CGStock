import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "./db"
import { getValidatedSession, type SessionPayload } from "./auth"
import { getUserSecurityContext, type UserSecurityContext } from "./user-context"
import type { PermissionKey } from "./permissions"

export const ACTIVE_WAREHOUSE_COOKIE = "cgstock_active_warehouse"

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

const SCOPE_TTL_MS = 30_000
const scopeMemoryCache = new Map<string, { value: WarehouseScope; expiresAt: number }>()
const warehousesMemoryCache = new Map<string, { value: AccessibleWarehouse[]; expiresAt: number }>()

export function invalidateWarehouseCache(userId?: string) {
  if (userId) {
    scopeMemoryCache.delete(userId)
    warehousesMemoryCache.delete(userId)
  } else {
    scopeMemoryCache.clear()
    warehousesMemoryCache.clear()
  }
}

/**
 * IDs dos almoxarifados aos quais o usuário tem acesso, ou o símbolo
 * ALL_WAREHOUSES quando o usuário é ADMIN ou tem acesso total explícito.
 * Dedup por request.
 */
export const getWarehouseScope = cache(async (userId: string): Promise<WarehouseScope> => {
  const isTest = process.env.NODE_ENV === "test"
  if (!isTest) {
    const cached = scopeMemoryCache.get(userId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }
  }

  const ctx = await getUserSecurityContext(userId)
  if (!ctx) return []
  if (ctx.roleNames.includes("ADMIN") || ctx.allWarehouseAccess) {
    if (!isTest) scopeMemoryCache.set(userId, { value: ALL_WAREHOUSES, expiresAt: Date.now() + SCOPE_TTL_MS })
    return ALL_WAREHOUSES
  }

  const accesses = await db.userWarehouseAccess.findMany({
    where: { userId },
    select: { warehouseId: true },
  })
  const result = accesses.map(a => a.warehouseId)
  if (!isTest) scopeMemoryCache.set(userId, { value: result, expiresAt: Date.now() + SCOPE_TTL_MS })
  return result
})

export async function getAccessibleWarehouseIds(userId?: string): Promise<string[] | null> {
  const id = userId ?? (await requireUser()).session.userId
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

export type AccessibleWarehouse = {
  id: string
  name: string
  code: string
  source: string | null
}

/**
 * Retorna a lista de almoxarifados ativos aos quais o usuário tem acesso.
 */
export const getAccessibleWarehouses = cache(async (userId?: string): Promise<AccessibleWarehouse[]> => {
  const user = userId ?? (await requireUser()).session.userId
  const isTest = process.env.NODE_ENV === "test"
  if (!isTest) {
    const cached = warehousesMemoryCache.get(user)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }
  }

  const scope = await getWarehouseScope(user)
  let list: AccessibleWarehouse[]
  if (scope === ALL_WAREHOUSES) {
    list = await db.warehouse.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true, source: true },
      orderBy: { name: "asc" },
    })
  } else if (scope.length === 0) {
    list = []
  } else {
    list = await db.warehouse.findMany({
      where: { status: "ACTIVE", id: { in: scope } },
      select: { id: true, name: true, code: true, source: true },
      orderBy: { name: "asc" },
    })
  }

  if (!isTest) {
    warehousesMemoryCache.set(user, { value: list, expiresAt: Date.now() + SCOPE_TTL_MS })
  }
  return list
})

/**
 * Retorna o ID do almoxarifado selecionado no filtro global (cookie),
 * validado contra as permissões do usuário, ou "" (todos os permitidos).
 */
export const getActiveWarehouseId = cache(async (userId?: string): Promise<string> => {
  try {
    const cookieStore = await cookies()
    const cookieVal = cookieStore.get(ACTIVE_WAREHOUSE_COOKIE)?.value || ""
    if (!cookieVal) return ""
    const user = userId ?? (await requireUser()).session.userId
    const scope = await getWarehouseScope(user)
    if (scope === ALL_WAREHOUSES) return cookieVal
    return scope.includes(cookieVal) ? cookieVal : ""
  } catch {
    return ""
  }
})

/**
 * Resolve o filtro efetivo de almoxarifado combinando o parâmetro de URL (se informado),
 * o cookie global de almoxarifado ativo e o escopo de segurança do usuário.
 */
export const resolveWarehouseContext = cache(async (
  paramWarehouseId?: string | null,
  userId?: string
): Promise<{
  warehouses: AccessibleWarehouse[]
  selectedWarehouseId: string
  effectiveScopeIds: string[] | null
  warehouseWhere: { warehouseId: { in: string[] } } | undefined
}> => {
  const user = userId ?? (await requireUser()).session.userId
  const [warehouses, baseScope, activeCookieId] = await Promise.all([
    getAccessibleWarehouses(user),
    warehouseScopeIds(user),
    getActiveWarehouseId(user),
  ])

  // Se o parâmetro foi passado explicitamente na URL (mesmo se for "ALL" para limpar), respeita;
  // caso contrário usa o cookie global.
  let candidateId = ""
  if (paramWarehouseId !== undefined && paramWarehouseId !== null) {
    candidateId = paramWarehouseId === "ALL" ? "" : paramWarehouseId
  } else {
    candidateId = activeCookieId
  }

  const validSelected = candidateId && warehouses.some(w => w.id === candidateId) ? candidateId : ""

  let effectiveScopeIds: string[] | null = baseScope
  if (validSelected) {
    effectiveScopeIds = [validSelected]
  }

  const warehouseWhere = effectiveScopeIds === null ? undefined : { warehouseId: { in: effectiveScopeIds } }

  return {
    warehouses,
    selectedWarehouseId: validSelected,
    effectiveScopeIds,
    warehouseWhere,
  }
})
