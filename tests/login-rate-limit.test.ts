import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "10.0.0.1" })),
}))
vi.mock("@/lib/auth", () => ({
  createSession: vi.fn(),
}))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))

const dbMock = vi.hoisted(() => ({
  loginAttempt: { count: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn() },
}))

vi.mock("@/lib/db", () => ({ db: dbMock }))

import { loginAction } from "@/app/login/actions"

function makeForm(email: string, password: string) {
  const formData = new FormData()
  formData.set("email", email)
  formData.set("password", password)
  return formData
}

describe("loginAction rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.loginAttempt.create.mockResolvedValue({})
    dbMock.user.findUnique.mockResolvedValue(null)
  })

  it("bloqueia após 5 falhas recentes sem consultar o usuário", async () => {
    dbMock.loginAttempt.count.mockResolvedValue(5)

    const result = await loginAction(null, makeForm("alvo@teste.com", "qualquer1"))

    expect(result).toEqual({ error: expect.stringContaining("Muitas tentativas") })
    expect(dbMock.user.findUnique).not.toHaveBeenCalled()
  })

  it("registra tentativa falha para credenciais erradas", async () => {
    dbMock.loginAttempt.count.mockResolvedValue(0)

    const result = await loginAction(null, makeForm("alvo@teste.com", "errada123"))

    expect(result).toEqual({ error: "Credenciais inválidas." })
    expect(dbMock.loginAttempt.create).toHaveBeenCalledWith({
      data: { email: "alvo@teste.com", ip: "10.0.0.1", success: false },
    })
  })

  it("permite tentativa quando dentro do limite", async () => {
    dbMock.loginAttempt.count.mockResolvedValue(4)
    const result = await loginAction(null, makeForm("alvo@teste.com", "errada123"))
    expect(result).toEqual({ error: "Credenciais inválidas." })
  })
})
