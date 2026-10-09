import { getValidatedSession } from "./auth"
import { getUserSecurityContext } from "./user-context"
import { redirect } from "next/navigation"

export type PermissionKey = 
  | 'PRODUCT_VIEW' | 'PRODUCT_CREATE' | 'PRODUCT_UPDATE' | 'PRODUCT_DELETE'
  | 'STOCK_VIEW' | 'STOCK_ENTRY' | 'STOCK_EXIT' | 'STOCK_ADJUST' | 'STOCK_TRANSFER'
  | 'REQUEST_CREATE' | 'REQUEST_APPROVE' | 'REQUEST_FULFILL'
  | 'INVENTORY_CREATE' | 'INVENTORY_COUNT' | 'INVENTORY_REVIEW' | 'INVENTORY_APPROVE'
  | 'REPORT_VIEW' | 'REPORT_EXPORT'
  | 'USER_VIEW' | 'USER_MANAGE'
  | 'CONFIG_MANAGE' | 'AUDIT_VIEW'

export async function hasPermission(permissionKey: PermissionKey): Promise<boolean> {
  const session = await getValidatedSession()
  if (!session) return false

  // ADMIN sempre tem acesso a tudo
  if (session.roles?.includes('ADMIN')) return true

  const ctx = await getUserSecurityContext(session.userId)
  if (!ctx) return false

  return ctx.permissionKeys.has(permissionKey)
}

export async function requirePermission(permissionKey: PermissionKey) {
  const isAuthorized = await hasPermission(permissionKey)
  if (!isAuthorized) {
    throw new Error("Não autorizado: você não possui permissão para executar esta ação.")
  }
}

export async function requirePermissionPage(permissionKey: PermissionKey) {
  const isAuthorized = await hasPermission(permissionKey)
  if (!isAuthorized) {
    redirect("/unauthorized")
  }
}
