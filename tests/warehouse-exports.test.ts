import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/permissions", () => ({ requirePermission: vi.fn() }))
vi.mock("@/lib/dal", () => ({ warehouseIdFilter: vi.fn().mockResolvedValue({ warehouseId: { in: ["central"] } }) }))
vi.mock("@/lib/db", () => ({ db: {
  stock: { findMany: vi.fn().mockResolvedValue([]) },
  stockMovement: { findMany: vi.fn().mockResolvedValue([]) },
  inventory: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) }
} }))

import { db } from "@/lib/db"
import { exportStockData, exportMovementsData, getInventoriesList, exportInventoryData } from "@/app/export/actions"

beforeEach(() => vi.clearAllMocks())

describe("exports de dados por almoxarifado", () => {
  it("restringe saldos e movimentos", async () => {
    await exportStockData()
    await exportMovementsData()
    expect(db.stock.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { warehouseId: { in: ["central"] } } }))
    expect(db.stockMovement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { warehouseId: { in: ["central"] } } }))
  })

  it("restringe lista e ID adulterado de inventário", async () => {
    await getInventoriesList()
    expect(db.inventory.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { warehouseId: { in: ["central"] } } }))
    await expect(exportInventoryData("outro")).rejects.toThrow("Inventário não encontrado")
    expect(db.inventory.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "outro", warehouseId: { in: ["central"] } } }))
  })
})
