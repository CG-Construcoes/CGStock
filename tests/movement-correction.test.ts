/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest"

const tx = vi.hoisted(() => ({
  stockMovement: { findUnique: vi.fn(), findMany: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db: { $transaction: (fn: any) => fn(tx) } }))
vi.mock("@/lib/audit", () => ({ logAuditStrict: vi.fn() }))
vi.mock("@/lib/stock", () => ({ createStockMovement: vi.fn(async () => ({ movement: { id: "corr-1" } })) }))

import { createStockMovement } from "@/lib/stock"
import { logAuditStrict } from "@/lib/audit"
import { correctMovement, correctionBlockReason, correctionType, effectiveQuantity } from "@/lib/movement-correction"

const original = {
  id: "mov-1", type: "ENTRY", referenceType: "RECEIPT", quantity: 10, unitCost: 2.5, productId: "p1",
  warehouseId: "w1", locationId: "l1", documentNumber: "1046", recipientUserId: null,
}

describe("movement-correction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.stockMovement.findUnique.mockResolvedValue(original)
    tx.stockMovement.findMany.mockResolvedValue([])
  })

  it("calcula a quantidade vigente considerando correções anteriores", () => {
    expect(effectiveQuantity({ type: "ENTRY", quantity: 10 }, [{ type: "ADJUSTMENT_OUT", quantity: -2 }])).toBe(8)
    expect(effectiveQuantity({ type: "EXIT", quantity: -5 }, [{ type: "ADJUSTMENT_OUT", quantity: -1 }])).toBe(6)
    expect(effectiveQuantity({ type: "EXIT", quantity: 5 }, [{ type: "ADJUSTMENT_IN", quantity: 2 }])).toBe(3)
  })

  it("escolhe a direção do ajuste conforme o tipo original", () => {
    expect(correctionType("ENTRY", 3)).toBe("ADJUSTMENT_IN")
    expect(correctionType("ENTRY", -3)).toBe("ADJUSTMENT_OUT")
    expect(correctionType("EXIT", 3)).toBe("ADJUSTMENT_OUT")
    expect(correctionType("EXIT", -3)).toBe("ADJUSTMENT_IN")
  })

  it("bloqueia ferramentaria e correção de correção", () => {
    expect(correctionBlockReason("EXIT", "TOOL_LOAN")).toBeTruthy()
    expect(correctionBlockReason("RETURN", "TOOL_LOAN_RETURN")).toBeTruthy()
    expect(correctionBlockReason("ADJUSTMENT_IN", "CORRECTION")).toBeTruthy()
    expect(correctionBlockReason("EXIT", "QUICK_ISSUE")).toBeNull()
    expect(correctionBlockReason("ENTRY", "RECEIPT")).toBeNull()
  })

  it("entrada lançada a mais gera ajuste de saída com a diferença, sem alterar o original", async () => {
    const result = await correctMovement({ movementId: "mov-1", newQuantity: 7, reason: "NF indica 7 unidades", userId: "u1" })

    expect(result).toEqual({ correctionId: "corr-1", from: 10, to: 7 })
    expect(createStockMovement).toHaveBeenCalledWith(expect.objectContaining({
      type: "ADJUSTMENT_OUT", quantity: 3, referenceType: "CORRECTION", referenceId: "mov-1", documentNumber: "1046", notes: "NF indica 7 unidades",
    }), tx)
    expect(logAuditStrict).toHaveBeenCalledWith("MOVEMENT_CORRECTED", "StockMovement", "mov-1", expect.objectContaining({ from: 10, to: 7 }), "u1", tx)
  })

  it("entrada lançada a menos gera ajuste de entrada com o custo unitário original", async () => {
    await correctMovement({ movementId: "mov-1", newQuantity: 12, reason: "faltou lançar 2", userId: "u1" })
    expect(createStockMovement).toHaveBeenCalledWith(expect.objectContaining({ type: "ADJUSTMENT_IN", quantity: 2, unitCost: 2.5, totalCost: 5 }), tx)
  })

  it("exige motivo e rejeita quantidade igual", async () => {
    await expect(correctMovement({ movementId: "mov-1", newQuantity: 7, reason: "", userId: "u1" })).rejects.toThrow("motivo")
    await expect(correctMovement({ movementId: "mov-1", newQuantity: 10, reason: "sem mudança", userId: "u1" })).rejects.toThrow("igual")
    expect(createStockMovement).not.toHaveBeenCalled()
  })
})
