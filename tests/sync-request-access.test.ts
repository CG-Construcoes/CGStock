import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  permission: vi.fn(),
  warehouseAccess: vi.fn(),
  findUnique: vi.fn(),
  productFind: vi.fn(),
  requestCount: vi.fn(),
  transaction: vi.fn()
}))

vi.mock("@/lib/auth", () => ({ getValidatedSession: mocks.session }))
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.permission }))
vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: mocks.warehouseAccess }))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))
vi.mock("@/lib/db", () => ({
  db: {
    offlineSyncOperation: { findUnique: mocks.findUnique },
    product: { findMany: mocks.productFind },
    materialRequest: { count: mocks.requestCount },
    $transaction: mocks.transaction
  }
}))

import { POST } from "@/app/api/sync/request/route"

const payload = {
  warehouseId: "warehouse-1", priority: "NORMAL", notes: "Reposição", actionType: "PENDING_APPROVAL",
  items: [{ productId: "product-1", unitId: "unit-1", requestedQuantity: 3 }]
}

function request(data = payload, key = "request-op-1") {
  return { json: async () => ({ payload: data, idempotencyKey: key, userId: "user-1" }) } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ userId: "user-1", roles: ["SOLICITANTE"] })
  mocks.permission.mockResolvedValue(true)
  mocks.warehouseAccess.mockResolvedValue(undefined)
  mocks.findUnique.mockResolvedValue(null)
  mocks.productFind.mockResolvedValue([{ id: "product-1", unitId: "unit-1" }])
  mocks.requestCount.mockResolvedValue(0)
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      offlineSyncOperation: {
        create: vi.fn().mockResolvedValue({ id: "op-1" }),
        update: vi.fn().mockResolvedValue({})
      },
      materialRequest: { create: vi.fn().mockResolvedValue({ id: "req-1" }) }
    }))
})

it("requires REQUEST_CREATE permission", async () => {
  mocks.permission.mockResolvedValue(false)
  const response = await POST(request())
  expect(response.status).toBe(403)
  expect(mocks.transaction).not.toHaveBeenCalled()
})

it("rejects operations from another user", async () => {
  const req = { json: async () => ({ payload, idempotencyKey: "key-12345", userId: "other-user" }) } as never
  const response = await POST(req)
  expect(response.status).toBe(403)
  expect(mocks.transaction).not.toHaveBeenCalled()
})

it("blocks requests for warehouses outside the user's scope", async () => {
  mocks.warehouseAccess.mockRejectedValue(new Error("Sem acesso"))
  const response = await POST(request())
  expect(response.status).toBe(403)
  expect(mocks.transaction).not.toHaveBeenCalled()
})

it("rejects items whose unit does not match the product", async () => {
  mocks.productFind.mockResolvedValue([{ id: "product-1", unitId: "unit-other" }])
  const response = await POST(request())
  expect(response.status).toBe(400)
  expect(mocks.transaction).not.toHaveBeenCalled()
})

it("creates the request inside a transaction and returns its number", async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.success).toBe(true)
  expect(body.requestNumber).toBe("REQ-0001")
})
