import { expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ getValidatedSession: vi.fn().mockResolvedValue({ userId: "joao", roles: ["GESTOR"], name: "João" }) }))
vi.mock("@/lib/dal", () => ({ warehouseIdFilter: vi.fn().mockResolvedValue({ warehouseId: { in: ["central"] } }), warehouseScopeIds: vi.fn().mockResolvedValue(["central"]) }))
vi.mock("@/lib/db", () => ({ db: {
  product: { count: vi.fn().mockResolvedValue(1) },
  inventoryDivergence: { count: vi.fn().mockResolvedValue(0) },
  stockTransfer: { count: vi.fn().mockResolvedValue(0) },
  inventory: { findMany: vi.fn().mockResolvedValue([]) },
  stockMovement: { findMany: vi.fn().mockResolvedValue([]) },
  $queryRaw: vi.fn().mockResolvedValue([])
} }))

import { db } from "@/lib/db"
import DashboardPage from "@/app/dashboard/page"

it("dashboard restringe produtos, indicadores, transferências e consultas por almoxarifado", async () => {
  await DashboardPage({})
  expect(db.product.count).toHaveBeenCalledWith({ where: { stocks: { some: { warehouseId: { in: ["central"] } } } } })
  expect(db.inventoryDivergence.count).toHaveBeenCalledWith({ where: { status: "PENDING", inventory: { warehouseId: { in: ["central"] } } } })
  expect(db.stockTransfer.count).toHaveBeenCalledWith({ where: { status: "IN_TRANSIT", sourceWarehouseId: { in: ["central"] }, destinationWarehouseId: { in: ["central"] } } })
  expect(db.stockMovement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { warehouseId: { in: ["central"] } } }))
  expect(db.$queryRaw).toHaveBeenCalled()
})
