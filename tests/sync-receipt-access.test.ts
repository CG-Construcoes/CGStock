import { expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ getValidatedSession: vi.fn().mockResolvedValue({ userId: "joao", roles: ["ALMOXARIFE"] }) }))
vi.mock("@/lib/permissions", () => ({ hasPermission: vi.fn().mockResolvedValue(true) }))
vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: vi.fn().mockRejectedValue(new Error("Não autorizado")) }))
vi.mock("@/lib/db", () => ({ db: { stockReceipt: { create: vi.fn() }, $transaction: vi.fn() } }))
vi.mock("@/lib/stock", () => ({ createStockMovement: vi.fn() }))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))

import { db } from "@/lib/db"
import { POST } from "@/app/api/sync/receipt/route"

it("sync de recebimento recusa ID adulterado sem gravar", async () => {
  const request = { json: async () => ({ payload: { warehouseId: "outro", items: [{ locationId: "loc", productId: "p", quantity: 1 }] } }) }
  const response = await POST(request as never)
  expect(response.status).toBe(403)
  expect(db.stockReceipt.create).not.toHaveBeenCalled()
  expect(db.$transaction).not.toHaveBeenCalled()
})
