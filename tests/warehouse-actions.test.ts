/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/action-guard", () => ({
  requireActionPermission: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    warehouse: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    warehouseLocation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    stock: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: vi.fn() }))
vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
  logAuditStrict: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

import { requireActionPermission } from "@/lib/action-guard"
import { db } from "@/lib/db"
import { 
  deleteWarehouseAction, 
  inactivateWarehouseAction, 
  createDefaultWarehouseLocationAction,
  addLocationToWarehouseAction 
} from "@/app/admin/warehouses/actions"

describe("Warehouse Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireActionPermission).mockResolvedValue({
      userId: "admin-1",
      roles: ["ADMIN"],
      name: "Admin",
      email: "admin@test.com",
      expiresAt: new Date(),
    } as any)
  })

  it("retorna erro se almoxarifado não for encontrado", async () => {
    vi.mocked(db.warehouse.findUnique).mockResolvedValue(null)
    const res = await deleteWarehouseAction("invalid-id", "INVALID")
    expect(res).toEqual({ error: "Almoxarifado não encontrado." })
  })

  it("exige confirmação à escrita exata para excluir", async () => {
    vi.mocked(db.warehouse.findUnique).mockResolvedValue({
      id: "wh-1",
      name: "Almoxarifado Central",
      code: "ALM-01",
      locations: []
    } as any)

    // Sem código
    const resNoCode = await deleteWarehouseAction("wh-1")
    expect(resNoCode.error).toContain("Confirmação incorreta")

    // Código errado
    const resWrongCode = await deleteWarehouseAction("wh-1", "ERRADO")
    expect(resWrongCode.error).toContain("Confirmação incorreta")
  })

  it("permite exclusão física completa em cascata quando o código de confirmação estiver correto", async () => {
    vi.mocked(db.warehouse.findUnique).mockResolvedValue({
      id: "wh-1",
      name: "Almoxarifado Central",
      code: "ALM-01",
      locations: [{ id: "loc-1" }]
    } as any)

    vi.mocked(db.$transaction).mockImplementation(async (callback: any) => {
      const mockTx = {
        product: { updateMany: vi.fn() },
        importBatch: { updateMany: vi.fn() },
        quickIssueItem: { deleteMany: vi.fn() },
        quickIssue: { deleteMany: vi.fn() },
        stockTransfer: { findMany: vi.fn().mockResolvedValue([]) },
        materialReturnItem: { deleteMany: vi.fn() },
        materialReturn: { deleteMany: vi.fn() },
        materialRequest: { findMany: vi.fn().mockResolvedValue([]) },
        inventory: { findMany: vi.fn().mockResolvedValue([]) },
        stockReceipt: { findMany: vi.fn().mockResolvedValue([]) },
        stockMovement: { deleteMany: vi.fn() },
        stock: { deleteMany: vi.fn() },
        userWarehouseAccess: { deleteMany: vi.fn() },
        warehouseLocation: { updateMany: vi.fn(), deleteMany: vi.fn() },
        warehouse: { delete: vi.fn().mockResolvedValue({ id: "wh-1" }) },
      }
      return callback(mockTx)
    })

    const res = await deleteWarehouseAction("wh-1", "ALM-01")
    expect(res).toEqual({ success: true })
  })

  it("inativa almoxarifado com sucesso", async () => {
    vi.mocked(db.$transaction).mockImplementation(async (callback: any) => {
      const mockTx = {
        warehouse: {
          update: vi.fn().mockResolvedValue({ id: "wh-1", name: "Almoxarifado Central", status: "INACTIVE" }),
        },
      }
      return callback(mockTx)
    })

    const res = await inactivateWarehouseAction("wh-1")
    expect(res).toEqual({ success: true, name: "Almoxarifado Central" })
  })

  it("cria localização padrão para almoxarifado sem localizações", async () => {
    vi.mocked(db.warehouse.findUnique).mockResolvedValue({
      id: "wh-1",
      name: "Almoxarifado Central",
      code: "ALM-CEN"
    } as any)
    vi.mocked(db.warehouseLocation.findUnique).mockResolvedValue(null)
    vi.mocked(db.warehouseLocation.create).mockResolvedValue({
      id: "loc-1",
      warehouseId: "wh-1",
      code: "ALM-CEN-GERAL",
      name: "Estoque Geral",
      status: "ACTIVE"
    } as any)

    const res = await createDefaultWarehouseLocationAction("wh-1")
    expect(res.success).toBe(true)
    expect(res.location?.code).toBe("ALM-CEN-GERAL")
  })

  it("adiciona nova localização ao almoxarifado", async () => {
    vi.mocked(db.warehouseLocation.findUnique).mockResolvedValue(null)
    vi.mocked(db.warehouseLocation.create).mockResolvedValue({
      id: "loc-2",
      warehouseId: "wh-1",
      code: "ALM-CEN-A01",
      name: "Corredor A",
      status: "ACTIVE"
    } as any)

    const res = await addLocationToWarehouseAction({
      warehouseId: "wh-1",
      code: "ALM-CEN-A01",
      name: "Corredor A"
    })
    expect(res.success).toBe(true)
    expect(res.location?.code).toBe("ALM-CEN-A01")
  })
})
