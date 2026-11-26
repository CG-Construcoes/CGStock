import { describe, it, expect, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "10.0.0.1" })),
}))
vi.mock("@/lib/auth", () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
}))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))

const dbMock = vi.hoisted(() => ({
  loginAttempt: { count: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
}))

vi.mock("@/lib/db", () => ({ db: dbMock }))

import { loginAction } from "@/app/login/actions"
import { changePasswordAction } from "@/app/change-password/actions"
import { getSession } from "@/lib/auth"

function makeForm(fields: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) formData.set(key, value)
  return formData
}

function makeUser(overrides: Record<string, unknown>) {
  return {
    id: "u1",
    name: "Usuário Teste",
    email: "user@teste.com",
    roles: [],
    status: "ACTIVE",
    loginEnabled: true,
    passwordHash: bcrypt.hashSync("SenhaAtual123", 10),
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    sessionVersion: 1,
    ...overrides,
  }
}

describe("expiração de senha temporária", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.loginAttempt.count.mockResolvedValue(0)
    dbMock.loginAttempt.create.mockResolvedValue({})
  })

  it("bloqueia login quando a senha ainda é temporária e expirou", async () => {
    dbMock.user.findUnique.mockResolvedValue(makeUser({
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() - 60_000),
    }))

    const result = await loginAction(null, makeForm({ email: "user@teste.com", password: "SenhaAtual123" }))

    expect(result).toEqual({ error: expect.stringContaining("expirou") })
  })

  it("permite login com senha temporária dentro da validade", async () => {
    dbMock.user.findUnique.mockResolvedValue(makeUser({
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
    }))

    const result = await loginAction(null, makeForm({ email: "user@teste.com", password: "SenhaAtual123" }))

    expect(result).toEqual({ success: true })
  })

  it("não bloqueia usuário que já definiu senha definitiva (regressão)", async () => {
    // Cenário do bug: usuário trocou a temporária pela definitiva, mas
    // temporaryPasswordExpiresAt ficou no passado e derrubava o login.
    dbMock.user.findUnique.mockResolvedValue(makeUser({
      mustChangePassword: false,
      temporaryPasswordExpiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    }))

    const result = await loginAction(null, makeForm({ email: "user@teste.com", password: "SenhaAtual123" }))

    expect(result).toEqual({ success: true })
  })

  it("troca de senha limpa a expiração temporária sem pedir a senha temporária de novo", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "u1", sessionVersion: 1 } as never)
    dbMock.user.findUnique.mockResolvedValue(makeUser({
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
    }))
    dbMock.user.update.mockResolvedValue(makeUser({ sessionVersion: 2 }))

    const result = await changePasswordAction(null, makeForm({
      newPassword: "NovaSenha#456",
      confirmPassword: "NovaSenha#456",
    }))

    expect(result).toEqual({ success: true })
    expect(dbMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
      }),
    }))
  })

  it("recusa troca sem senha atual quando o usuário não está obrigado a trocar", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "u1", sessionVersion: 1 } as never)
    dbMock.user.findUnique.mockResolvedValue(makeUser({ mustChangePassword: false }))

    const result = await changePasswordAction(null, makeForm({ newPassword: "NovaSenha#456", confirmPassword: "NovaSenha#456" }))

    expect(result).toEqual({ error: expect.any(String) })
    expect(dbMock.user.update).not.toHaveBeenCalled()
  })

  it("recusa troca com sessão revogada", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "u1", sessionVersion: 0 } as never)
    dbMock.user.findUnique.mockResolvedValue(makeUser({ mustChangePassword: true }))

    const result = await changePasswordAction(null, makeForm({ newPassword: "NovaSenha#456", confirmPassword: "NovaSenha#456" }))

    expect(result).toEqual({ error: expect.any(String) })
    expect(dbMock.user.update).not.toHaveBeenCalled()
  })
})
