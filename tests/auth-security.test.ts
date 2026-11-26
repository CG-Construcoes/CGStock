import { beforeEach, describe, expect, it, vi } from "vitest"
import { SignJWT } from "jose"

const mocks = vi.hoisted(() => ({ cookie: vi.fn(), context: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }))
vi.mock("@/lib/auth-secret", () => ({ jwtKey: new TextEncoder().encode("test-secret-for-security-regression-only") }))
vi.mock("@/lib/user-context", () => ({
  getUserSecurityContext: mocks.context,
  invalidateUserSecurityCache: vi.fn(),
}))

import { decrypt, getValidatedSession } from "@/lib/auth"
import { jwtKey } from "@/lib/auth-secret"

const token = (payload: Record<string, unknown>) => new SignJWT(payload)
  .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(jwtKey)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.context.mockResolvedValue({
    status: "ACTIVE", sessionVersion: 2, roleNames: ["ALMOXARIFE"], mustChangePassword: false,
  })
})

describe("validação de sessão", () => {
  it("recusa usar um token de redefinição como sessão", async () => {
    expect(await decrypt(await token({ purpose: "password-reset", sub: "u1" }))).toBeNull()
    expect(await decrypt(await token({ purpose: "password-reset", userId: "u1" }))).toBeNull()
  })

  it("recusa tokens sem usuário ou expiração", async () => {
    expect(await decrypt(await token({ roles: ["ADMIN"] }))).toBeNull()
    const noExpiry = await new SignJWT({ userId: "u1" }).setProtectedHeader({ alg: "HS256" }).sign(jwtKey)
    expect(await decrypt(noExpiry)).toBeNull()
  })

  it("remove ADMIN de cookie antigo após alteração do perfil no banco", async () => {
    mocks.cookie.mockReturnValue({ value: await token({ userId: "u1", roles: ["ADMIN"], sessionVersion: 2 }) })
    expect(await getValidatedSession()).toMatchObject({ roles: ["ALMOXARIFE"] })
  })

  it("reflete troca obrigatória de senha atualizada no banco", async () => {
    mocks.cookie.mockReturnValue({ value: await token({ userId: "u1", mustChangePassword: false, sessionVersion: 2 }) })
    mocks.context.mockResolvedValue({ status: "ACTIVE", sessionVersion: 2, roleNames: [], mustChangePassword: true })
    expect(await getValidatedSession()).toMatchObject({ mustChangePassword: true })
  })

  it("recusa sessões revogadas e usuários inativos", async () => {
    mocks.cookie.mockReturnValue({ value: await token({ userId: "u1", sessionVersion: 1 }) })
    expect(await getValidatedSession()).toBeNull()
    mocks.cookie.mockReturnValue({ value: await token({ userId: "u1", sessionVersion: 2 }) })
    mocks.context.mockResolvedValue({ status: "INACTIVE", sessionVersion: 2 })
    expect(await getValidatedSession()).toBeNull()
  })

  it("tokens legados sem versão não contornam revogação", async () => {
    mocks.cookie.mockReturnValue({ value: await token({ userId: "u1", roles: ["ADMIN"] }) })
    expect(await getValidatedSession()).toBeNull()
    mocks.context.mockResolvedValue({ status: "ACTIVE", sessionVersion: 0, roleNames: [], mustChangePassword: false })
    expect(await getValidatedSession()).toMatchObject({ userId: "u1" })
  })
})
