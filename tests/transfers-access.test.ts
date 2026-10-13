import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/action-guard", () => ({ requireActionPermission: vi.fn().mockResolvedValue({ userId: "joao" }) }))
vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: {
  warehouseLocation: { findUnique: vi.fn() },
  stockTransfer: { count: vi.fn(), create: vi.fn() }
} }))
vi.mock("@/lib/stock", () => ({ executeStockTransfer: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect") }) }))

import { db } from "@/lib/db"
import { assertWarehouseAccess } from "@/lib/dal"
import { createTransferAction } from "@/app/transfers/actions"

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.warehouseLocation.findUnique)
    .mockResolvedValueOnce({ warehouseId: "central" } as never)
    .mockResolvedValueOnce({ warehouseId: "obra-a" } as never)
})

describe("transferência com origem e destino", () => {
  it("recusa destino adulterado antes de criar transferência", async () => {
    vi.mocked(assertWarehouseAccess).mockResolvedValueOnce().mockRejectedValueOnce(new Error("Não autorizado"))
    const data = new FormData()
    data.set("sourceLocationId", "origem")
    data.set("destinationLocationId", "destino")
    await expect(createTransferAction(data)).rejects.toThrow("Não autorizado")
    expect(assertWarehouseAccess).toHaveBeenNthCalledWith(1, "central", "joao")
    expect(assertWarehouseAccess).toHaveBeenNthCalledWith(2, "obra-a", "joao")
    expect(db.stockTransfer.create).not.toHaveBeenCalled()
  })
})
