import { jwtVerify, SignJWT } from "jose"
import { cookies } from "next/headers"
import { jwtKey } from "./auth-secret"
import { getUserSecurityContext } from "./user-context"

export type SessionPayload = {
  userId: string
  name: string
  email: string
  roles: string[]
  mustChangePassword?: boolean
  sessionVersion?: number
  expiresAt: Date
}

export async function encrypt(payload: import('jose').JWTPayload & SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(jwtKey)
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, jwtKey, {
      algorithms: ["HS256"],
    })
    // Backwards compatibility for old sessions that had { role: string }
    if (payload.role && !payload.roles) {
      if (payload.role === 'Administrador Sistema') {
        payload.roles = ['ADMIN']
      } else {
        payload.roles = [payload.role as string]
      }
    }
    return payload as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(userId: string, name: string, email: string, roles: string[], mustChangePassword: boolean = false, sessionVersion: number = 0) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  
  const payload: SessionPayload = {
    userId,
    name,
    email,
    roles,
    mustChangePassword,
    sessionVersion,
    expiresAt,
  }

  const session = await encrypt(payload)

  const cookieStore = await cookies()
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  })
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value
  if (!session) return null
  return await decrypt(session)
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}

/**
 * Retorna a sessão somente se o usuário ainda estiver ativo e a versão de
 * sessão do token corresponder à do banco (ou seja, não foi revogada).
 * Usar em pontos sensíveis: mutations, dados protegidos.
 */
export async function getValidatedSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session) return null

  const ctx = await getUserSecurityContext(session.userId)

  if (!ctx || ctx.status !== "ACTIVE") return null
  if (session.sessionVersion !== undefined && ctx.sessionVersion !== session.sessionVersion) return null

  return session
}
