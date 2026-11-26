import { beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), update: vi.fn(), createSession: vi.fn(), audit: vi.fn(),
}))
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.findUnique, update: mocks.update } } }))
vi.mock("@/lib/auth-secret", () => ({ jwtKey: new TextEncoder().encode("password-reset-regression-test-key") }))
vi.mock("@/lib/auth", () => ({ createSession: mocks.createSession }))
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }))

import { resetPasswordWithTokenAction } from "@/app/reset-password/actions"
import { ADMIN_RESET_TTL_MINUTES, SELF_RESET_TTL_MINUTES, createPasswordResetToken, verifyPasswordResetToken } from "@/lib/password-reset"

let user: {
  id: string; name: string; email: string; passwordHash: string;
  sessionVersion: number; status: string; loginEnabled: boolean;
  roles: { name: string }[];
}

function form(token: string, password = "NovaSenha#456") {
  const data = new FormData()
  data.set("token", token)
  data.set("newPassword", password)
  data.set("confirmPassword", password)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  user = {
    id: "u1", name: "Maria Teste", email: "maria@example.com", passwordHash: "old-hash",
    sessionVersion: 3, status: "ACTIVE", loginEnabled: true, roles: [{ name: "ALMOXARIFE" }],
  }
  mocks.findUnique.mockImplementation(async () => ({ ...user }))
  mocks.update.mockImplementation(async ({ data }) => {
    user = { ...user, passwordHash: data.passwordHash, sessionVersion: user.sessionVersion + 1 }
    return { ...user }
  })
})

describe("redefinição de senha por link", () => {
  it.each([SELF_RESET_TTL_MINUTES, ADMIN_RESET_TTL_MINUTES])(
    "redireciona no servidor após salvar e criar sessão (validade %i minutos)",
    async ttl => {
      const token = await createPasswordResetToken(user, ttl)
      await expect(resetPasswordWithTokenAction(null, form(token))).rejects.toMatchObject({
        digest: expect.stringContaining("/dashboard"),
      })

      expect(await bcrypt.compare("NovaSenha#456", user.passwordHash)).toBe(true)
      expect(mocks.createSession).toHaveBeenCalledWith("u1", "Maria Teste", "maria@example.com", ["ALMOXARIFE"], false, 4)
      expect(mocks.audit).toHaveBeenCalledWith("PASSWORD_RESET_COMPLETED", "User", "u1", { via: "email-link" }, "u1")
      // O link continua de uso único, mas sua invalidação não re-renderiza o formulário.
      expect(await verifyPasswordResetToken(token)).toBeNull()
      expect(await resetPasswordWithTokenAction(null, form(token))).toMatchObject({ expired: true })
      expect(mocks.update).toHaveBeenCalledTimes(1)
      expect(mocks.createSession).toHaveBeenCalledTimes(1)
    },
  )

  it("recusa link expirado sem alterar senha ou iniciar sessão", async () => {
    const token = await createPasswordResetToken(user, -1)
    expect(await resetPasswordWithTokenAction(null, form(token))).toMatchObject({ expired: true })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it("mantém o link válido quando a nova senha não atende à política", async () => {
    const token = await createPasswordResetToken(user)
    expect(await resetPasswordWithTokenAction(null, form(token, "123"))).toHaveProperty("error")
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.createSession).not.toHaveBeenCalled()
    expect(await verifyPasswordResetToken(token)).not.toBeNull()
  })
})
