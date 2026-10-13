/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest"
vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: vi.fn() }))
import { assertWarehouseAccess } from "@/lib/dal"
import { createStockMovement } from "@/lib/stock"

const tx = {
  product: { findUnique: vi.fn(), update: vi.fn() },
  warehouse: { findUnique: vi.fn() },
  warehouseLocation: { findUnique: vi.fn() },
  stockMovement: { create: vi.fn() },
  stock: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
  },
} as any

const baseParams = {
  productId: "prod-1",
  warehouseId: "wh-1",
  locationId: "loc-1",
  quantity: 5,
  performedById: "user-1",
}

describe("createStockMovement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.product.findUnique.mockResolvedValue({ id: "prod-1", averageCost: 10 })
    tx.warehouse.findUnique.mockResolvedValue({ id: "wh-1" })
    tx.warehouseLocation.findUnique.mockResolvedValue({ id: "loc-1", warehouseId: "wh-1", code: "A01" })
    tx.stockMovement.create.mockResolvedValue({ id: "mov-1" })
  })

  it("recusa movimentação no almoxarifado não autorizado antes de gravar", async () => {
    vi.mocked(assertWarehouseAccess).mockRejectedValueOnce(new Error("Não autorizado"))
    await expect(createStockMovement({ ...baseParams, type: "EXIT" }, tx)).rejects.toThrow("Não autorizado")
    expect(tx.stockMovement.create).not.toHaveBeenCalled()
  })

  it("rejeita quantidade zero", async () => {
    await expect(
      createStockMovement({ ...baseParams, quantity: 0, type: "ENTRY" }, tx)
    ).rejects.toThrow("zero")
  })

  it("entrada faz upsert com incremento", async () => {
    tx.stock.upsert.mockResolvedValue({ id: "stk-1", quantity: 10 })
    tx.stock.aggregate.mockResolvedValue({ _sum: { quantity: 10 } })
    tx.product.update.mockResolvedValue({})

    await createStockMovement({ ...baseParams, type: "ENTRY", unitCost: 10 }, tx)

    expect(tx.stock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { quantity: { increment: 5 } },
      })
    )
    expect(tx.product.update).toHaveBeenCalled() // custo médio atualizado
  })

  it("saída usa débito atômico com guarda de saldo", async () => {
    tx.stock.updateMany.mockResolvedValue({ count: 1 })
    tx.stock.findUniqueOrThrow.mockResolvedValue({ id: "stk-1", quantity: 3 })

    await createStockMovement({ ...baseParams, type: "EXIT" }, tx)

    expect(tx.stock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ quantity: { gte: 5 } }),
        data: { quantity: { increment: -5 } },
      })
    )
  })

  it("saída maior que o saldo lança erro e não altera estoque", async () => {
    tx.stock.updateMany.mockResolvedValue({ count: 0 })
    tx.stock.findUnique.mockResolvedValue({ id: "stk-1", quantity: 2 })

    await expect(
      createStockMovement({ ...baseParams, type: "EXIT" }, tx)
    ).rejects.toThrow(/Estoque insuficiente.*Saldo atual: 2/)

    expect(tx.stock.upsert).not.toHaveBeenCalled()
    expect(tx.stock.update).toBeUndefined()
  })

  it("rejeita localização de outro almoxarifado", async () => {
    tx.warehouseLocation.findUnique.mockResolvedValue({ id: "loc-1", warehouseId: "outro", code: "A01" })
    await expect(
      createStockMovement({ ...baseParams, type: "ENTRY" }, tx)
    ).rejects.toThrow("não pertence")
  })
})
