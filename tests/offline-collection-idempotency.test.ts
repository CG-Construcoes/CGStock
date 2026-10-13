import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  replay: vi.fn(), operationCreate: vi.fn(), operationUpdate: vi.fn(),
  inventoryFind: vi.fn(), collectionFind: vi.fn(), collectionCreate: vi.fn(),
  locationUpdate: vi.fn(), transaction: vi.fn()
}))

vi.mock("@/lib/auth", () => ({ getValidatedSession: vi.fn().mockResolvedValue({ userId: "user-1", roles: ["ADMIN"] }) }))
vi.mock("@/lib/permissions", () => ({ hasPermission: vi.fn().mockResolvedValue(true) }))
vi.mock("@/lib/dal", () => ({ warehouseIdFilter: vi.fn().mockResolvedValue({}) }))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: {
  offlineSyncOperation: { findUnique: mocks.replay },
  inventory: { findUnique: mocks.inventoryFind },
  $transaction: mocks.transaction
} }))

import { POST } from "@/app/api/sync/route"
import { payloadHash } from "@/lib/sync-idempotency"

const payload = { inventoryId: "inventory-1", locationId: "location-1", items: [{ productId: "product-1", quantity: 2 }] }
function request(data = payload, key = "collection-123") {
  return new Request("http://localhost/api/sync", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "SUBMIT_COLLECTION", payload: data, idempotencyKey: key, userId: "user-1" })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.replay.mockResolvedValue(null)
  mocks.inventoryFind.mockResolvedValue({ status: "IN_PROGRESS", operators: [], locations: [{ locationId: "location-1" }] })
  mocks.operationCreate.mockResolvedValue({ id: "ledger-1" })
  mocks.collectionCreate.mockResolvedValue({ id: "collection-1" })
  mocks.collectionFind.mockResolvedValue(null)
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    offlineSyncOperation: { create: mocks.operationCreate, update: mocks.operationUpdate },
    inventoryCollection: { findFirst: mocks.collectionFind, create: mocks.collectionCreate },
    inventoryLocation: { update: mocks.locationUpdate }
  }))
})

it("saves the collection and its ledger in the same transaction", async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(mocks.operationCreate).toHaveBeenCalledOnce()
  expect(mocks.collectionCreate).toHaveBeenCalledOnce()
  expect(mocks.operationUpdate).toHaveBeenCalledWith({ where: { id: "ledger-1" }, data: { resultId: "collection-1" } })
})

it("accepts an identical retry even if the inventory was closed", async () => {
  mocks.inventoryFind.mockResolvedValue({ status: "COMPLETED", operators: [], locations: [{ locationId: "location-1" }] })
  mocks.replay.mockResolvedValue({ payloadHash: payloadHash(payload) })
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(mocks.transaction).not.toHaveBeenCalled()
})

it("requires manual review when the existing collection differs", async () => {
  mocks.collectionFind.mockResolvedValue({ id: "existing-1", items: [{ productId: "product-1", quantity: 4 }] })
  const response = await POST(request())
  expect(response.status).toBe(409)
  expect(mocks.collectionCreate).not.toHaveBeenCalled()
})
