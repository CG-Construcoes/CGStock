/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))
vi.mock("@/lib/stock", () => ({ deliverMaterialRequest: vi.fn() }))
vi.mock("@/lib/action-guard", () => ({
  requireSession: vi.fn(),
  requireActionPermission: vi.fn(),
}))
vi.mock("@/lib/permissions", () => ({ hasPermission: vi.fn() }))
vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: vi.fn(), warehouseIdFilter: vi.fn().mockResolvedValue({ warehouseId: { in: ['wh-1'] } }) }))

const dbMock = vi.hoisted(() => {
  const db: any = {
    materialRequest: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    materialRequestItem: { updateMany: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(db)),
    $executeRaw: vi.fn(),
  }
  return db
})

vi.mock("@/lib/db", () => ({ db: dbMock }))

import { requireSession, requireActionPermission } from "@/lib/action-guard"
import { hasPermission } from "@/lib/permissions"
import { assertWarehouseAccess } from "@/lib/dal"
import {
  createRequestAction,
  approveRequestAction,
  cancelRequestAction,
} from "@/app/requests/actions"

const session = { userId: "user-logado", roles: ["GESTOR"] }

describe("createRequestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireActionPermission).mockResolvedValue(session as any)
    dbMock.materialRequest.count.mockResolvedValue(0)
    dbMock.materialRequest.create.mockResolvedValue({ id: "req-1", requestNumber: "REQ-0001" })
  })

  it("usa o usuário da sessão como solicitante, ignorando requesterId do cliente", async () => {
    const formData = new FormData()
    formData.set("requesterId", "usuario-falsificado")
    formData.set("warehouseId", "wh-1")
    formData.set("priority", "NORMAL")
    formData.set("notes", "")
    formData.set("actionType", "PENDING_APPROVAL")
    formData.set("item_productId_a1", "prod-1")
    formData.set("item_quantity_a1", "3")
    formData.set("item_unitId_a1", "unit-1")

    await expect(createRequestAction(formData)).rejects.toThrow("NEXT_REDIRECT:/requests/req-1")

    expect(dbMock.materialRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requesterId: "user-logado" }),
      })
    )
  })

  it("recusa ID de almoxarifado não autorizado antes de criar", async () => {
    vi.mocked(assertWarehouseAccess).mockRejectedValueOnce(new Error("Não autorizado"))
    const formData = new FormData()
    formData.set("warehouseId", "outro")
    await expect(createRequestAction(formData)).rejects.toThrow("Não autorizado")
    expect(dbMock.materialRequest.create).not.toHaveBeenCalled()
  })

  it("rejeita quando não há sessão válida", async () => {
    vi.mocked(requireActionPermission).mockRejectedValue(new Error("Não autenticado"))
    const formData = new FormData()
    formData.set("requesterId", "usuario-falsificado")
    await expect(createRequestAction(formData)).rejects.toThrow("Não autenticado")
    expect(dbMock.materialRequest.create).not.toHaveBeenCalled()
  })
})

describe("approveRequestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireActionPermission).mockResolvedValue(session as any)
  })

  it("aprova com o aprovador da sessão e itens aprovados em lote", async () => {
    dbMock.materialRequest.findFirst.mockResolvedValue({ id: "req-1", status: "PENDING_APPROVAL" })
    dbMock.materialRequest.update.mockResolvedValue({})
    dbMock.$executeRaw.mockResolvedValue(2)

    await approveRequestAction("req-1")

    expect(dbMock.materialRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          approvedById: "user-logado",
        }),
      })
    )
    expect(dbMock.$executeRaw).toHaveBeenCalled()
  })

  it("não aprova requisição fora do status de aguardando", async () => {
    dbMock.materialRequest.findFirst.mockResolvedValue({ id: "req-1", status: "FULFILLED" })
    await expect(approveRequestAction("req-1")).rejects.toThrow("aguardando aprovação")
    expect(dbMock.materialRequest.update).not.toHaveBeenCalled()
  })

  it("rejeita acesso sem permissão", async () => {
    vi.mocked(requireActionPermission).mockRejectedValue(new Error("Não autorizado"))
    await expect(approveRequestAction("req-1")).rejects.toThrow("Não autorizado")
    expect(dbMock.materialRequest.findFirst).not.toHaveBeenCalled()
  })
})

describe("cancelRequestAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("solicitante pode cancelar a própria requisição rascunho", async () => {
    vi.mocked(requireSession).mockResolvedValue({ userId: "dono", roles: ["SOLICITANTE"] } as any)
    dbMock.materialRequest.findFirst.mockResolvedValue({ id: "req-1", status: "DRAFT", requesterId: "dono" })
    dbMock.materialRequest.update.mockResolvedValue({})

    await cancelRequestAction("req-1")

    expect(dbMock.materialRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } })
    )
  })

  it("terceiros sem permissão de aprovação não podem cancelar", async () => {
    vi.mocked(requireSession).mockResolvedValue({ userId: "outro", roles: ["SOLICITANTE"] } as any)
    vi.mocked(hasPermission).mockResolvedValue(false)
    dbMock.materialRequest.findFirst.mockResolvedValue({ id: "req-1", status: "DRAFT", requesterId: "dono" })

    await expect(cancelRequestAction("req-1")).rejects.toThrow("Apenas o solicitante")
    expect(dbMock.materialRequest.update).not.toHaveBeenCalled()
  })
})
