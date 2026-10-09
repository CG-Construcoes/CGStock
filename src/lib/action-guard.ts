import { getValidatedSession, type SessionPayload } from "./auth"
import { hasPermission, type PermissionKey } from "./permissions"

export async function requireSession(): Promise<SessionPayload> {
  const session = await getValidatedSession()
  if (!session) {
    throw new Error("Não autenticado: faça login para executar esta ação.")
  }
  return session
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession()
  if (!session.roles?.includes("ADMIN")) {
    throw new Error("Não autorizado: esta ação é restrita a administradores.")
  }
  return session
}

export async function requireActionPermission(permissionKey: PermissionKey): Promise<SessionPayload> {
  const session = await requireSession()
  if (session.roles?.includes("ADMIN")) return session

  const allowed = await hasPermission(permissionKey)
  if (!allowed) {
    throw new Error("Não autorizado: você não possui permissão para executar esta ação.")
  }
  return session
}
