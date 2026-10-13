import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  operationCreate: vi.fn(),
  operationUpdate: vi.fn(),
  receiptCreate: vi.fn(),
  transaction: vi.fn(),
  locationCount: vi.fn(),
  stockMovement: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ getValidatedSession: vi.fn().mockResolvedValue({ userId: "user-1", roles: ["ADMIN"] }) }))
vi.mock("@/lib/permissions", () => ({ hasPermission: vi.fn().mockResolvedValue(true) }))
vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/stock", () => ({ createStockMovement: mocks.stockMovement }))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: {
  offlineSyncOperation: { findUnique: mocks.findUnique },
  warehouseLocation: { count: mocks.locationCount },
  $transaction: mocks.transaction
} }))

import { POST } from "@/app/api/sync/receipt/route"

const payload = {
  supplierId: "supplier-1", warehouseId: "warehouse-1", actionType: "COMPLETED",
  items: [{ productId: "product-1", locationId: "location-1", quantity: 2, unitCost: 10 }]
}

function request(data = payload, key = "operation-123") {
  return { json: async () => ({ payload: data, idempotencyKey: key, userId: "user-1" }) } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findUnique.mockResolvedValue(null)
  mocks.locationCount.mockResolvedValue(1)
  mocks.operationCreate.mockResolvedValue({ id: "ledger-1" })
  mocks.receiptCreate.mockResolvedValue({
    id: "receipt-1", warehouseId: "warehouse-1", documentNumber: null,
    items: [{ productId: "product-1", locationId: "location-1", quantity: 2, unitCost: 10, totalCost: 20 }]
  })
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    offlineSyncOperation: { create: mocks.operationCreate, update: mocks.operationUpdate },
    stockReceipt: { create: mocks.receiptCreate }
  }))
})

it("commits the idempotency record with the receipt and movement", async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(mocks.operationCreate).toHaveBeenCalledOnce()
  expect(mocks.receiptCreate).toHaveBeenCalledOnce()
  expect(mocks.stockMovement).toHaveBeenCalledOnce()
  expect(mocks.operationUpdate).toHaveBeenCalledWith({ where: { id: "ledger-1" }, data: { resultId: "receipt-1" } })
})

it("replays an acknowledged operation without creating another receipt", async () => {
  const { payloadHash } = await import("@/lib/sync-idempotency")
  mocks.findUnique.mockResolvedValue({ payloadHash: payloadHash(payload) })
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect((await response.json()).alreadyProcessed).toBe(true)
  expect(mocks.transaction).not.toHaveBeenCalled()
})

it("returns a manual conflict when the same key carries changed data", async () => {
  mocks.findUnique.mockResolvedValue({ payloadHash: "other" })
  const response = await POST(request())
  expect(response.status).toBe(409)
  expect(mocks.transaction).not.toHaveBeenCalled()
})
