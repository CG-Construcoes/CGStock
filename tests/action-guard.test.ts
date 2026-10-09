/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  getValidatedSession: vi.fn(),
}))
vi.mock("@/lib/permissions", () => ({
  hasPermission: vi.fn(),
}))

import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { requireSession, requireAdmin, requireActionPermission } from "@/lib/action-guard"

const session = { userId: "u1", roles: ["ALMOXARIFE"], name: "n", email: "e", expiresAt: new Date() }

describe("requireSession", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lança erro sem sessão", async () => {
    vi.mocked(getValidatedSession).mockResolvedValue(null)
    await expect(requireSession()).rejects.toThrow("Não autenticado")
  })

  it("retorna a sessão válida", async () => {
    vi.mocked(getValidatedSession).mockResolvedValue(session as any)
    await expect(requireSession()).resolves.toBe(session)
  })
})

describe("requireAdmin", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejeita não-admin", async () => {
    vi.mocked(getValidatedSession).mockResolvedValue(session as any)
    await expect(requireAdmin()).rejects.toThrow("administradores")
  })

  it("aceita admin", async () => {
    vi.mocked(getValidatedSession).mockResolvedValue({ ...session, roles: ["ADMIN"] } as any)
    await expect(requireAdmin()).resolves.toBeTruthy()
  })
})

describe("requireActionPermission", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ADMIN ignora verificação de permissão", async () => {
    vi.mocked(getValidatedSession).mockResolvedValue({ ...session, roles: ["ADMIN"] } as any)
    await requireActionPermission("PRODUCT_DELETE")
    expect(hasPermission).not.toHaveBeenCalled()
  })

  it("rejeita quem não tem a permissão", async () => {
    vi.mocked(getValidatedSession).mockResolvedValue(session as any)
    vi.mocked(hasPermission).mockResolvedValue(false)
    await expect(requireActionPermission("PRODUCT_DELETE")).rejects.toThrow("Não autorizado")
  })

  it("aceita quem tem a permissão", async () => {
    vi.mocked(getValidatedSession).mockResolvedValue(session as any)
    vi.mocked(hasPermission).mockResolvedValue(true)
    await expect(requireActionPermission("PRODUCT_DELETE")).resolves.toBe(session)
  })
})
