/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest"

const dbMock = vi.hoisted(() => ({
  product: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  productUnit: { findUnique: vi.fn() },
  productCategory: { findUnique: vi.fn() },
  warehouseLocation: { findUnique: vi.fn(), findFirst: vi.fn() },
  stock: { findUnique: vi.fn(), findFirst: vi.fn() },
  stockMovement: { create: vi.fn() },
  $transaction: vi.fn(async (fn: any) => fn(dbMock)),
}))
vi.mock("@/lib/db", () => ({ db: dbMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))
vi.mock("@/lib/action-guard", () => ({ requireSession: vi.fn(async () => ({ userId: "u1" })) }))
vi.mock("@/lib/permissions", () => ({ hasPermission: vi.fn(async () => true) }))
vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: vi.fn(), warehouseScopeIds: vi.fn(async () => null) }))
vi.mock("@/lib/stock", () => ({ createStockMovement: vi.fn(async () => ({ movement: { id: "mov-1" } })) }))
vi.mock("@/lib/informakon", () => ({ pushInsumoUpdate: vi.fn() }))

import { logAudit } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { createStockMovement } from "@/lib/stock"
import { quickSetStockAction, updateProductFieldAction } from "@/app/products/quick-edit-actions"

const product = {
  unitId: "un-1", averageCost: 10, status: "ACTIVE", minimumStock: 2, maximumStock: 50, categoryId: "c1",
  informakonKey: null, unit: { code: "UN" }, category: { name: "Geral" },
}

describe("edição rápida", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.product.findUnique.mockResolvedValue({ defaultLocation: null, stocks: [{ warehouseId: "w1" }] })
    dbMock.product.findUniqueOrThrow.mockResolvedValue(product)
    dbMock.warehouseLocation.findUnique.mockResolvedValue({ id: "l1", code: "GALPAO 04", warehouseId: "w1" })
    dbMock.stock.findFirst.mockResolvedValue({ location: { id: "l1", warehouseId: "w1" } })
  })

  it("altera a unidade e registra antes/depois", async () => {
    dbMock.productUnit.findUnique.mockResolvedValue({ id: "un-2", code: "M" })
    const res = await updateProductFieldAction("p1", "unitId", "un-2")
    expect(res.success).toContain("UN → M")
    expect(dbMock.product.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { unitId: "un-2" } })
    expect(logAudit).toHaveBeenCalledWith("PRODUCT_QUICK_EDIT", "Product", "p1", expect.objectContaining({ label: "Unidade", from: "UN", to: "M" }), "u1", dbMock)
    expect(dbMock.stockMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "EDIT", performedById: "u1", reason: "Unidade: UN → M" }),
    }))
  })

  it("altera o custo médio", async () => {
    await updateProductFieldAction("p1", "averageCost", 12.5)
    expect(dbMock.product.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { averageCost: 12.5 } })
  })

  it("não deixa o mínimo passar do máximo", async () => {
    const res = await updateProductFieldAction("p1", "minimumStock", 80)
    expect(res.error).toBeTruthy()
    expect(dbMock.product.update).not.toHaveBeenCalled()
  })

  it("exige permissão de edição de produto", async () => {
    vi.mocked(hasPermission).mockResolvedValueOnce(false)
    const res = await updateProductFieldAction("p1", "status", "INACTIVE")
    expect(res.error).toBeTruthy()
  })

  it("editar o saldo gera movimentação de edição rápida com a diferença", async () => {
    dbMock.stock.findUnique.mockResolvedValue({ quantity: 11, reservedQuantity: 0 })
    const res = await quickSetStockAction({ productId: "p1", locationId: "l1", newQuantity: 11000 })
    expect(res.success).toBeTruthy()
    expect(createStockMovement).toHaveBeenCalledWith(expect.objectContaining({
      type: "ADJUSTMENT_IN", quantity: 10989, referenceType: "QUICK_EDIT", notes: "Edição rápida na lista",
    }), expect.anything())
  })

  it("reduzir o saldo gera saída e respeita o reservado", async () => {
    dbMock.stock.findUnique.mockResolvedValue({ quantity: 10, reservedQuantity: 4 })
    expect((await quickSetStockAction({ productId: "p1", locationId: "l1", newQuantity: 3 })).error).toContain("reservado")
    await quickSetStockAction({ productId: "p1", locationId: "l1", newQuantity: 6, reason: "contagem" })
    expect(createStockMovement).toHaveBeenCalledWith(expect.objectContaining({ type: "ADJUSTMENT_OUT", quantity: 4, notes: "contagem" }), expect.anything())
  })
})
