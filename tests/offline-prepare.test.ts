import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  ctx: vi.fn(),
  scope: vi.fn(),
  warehouseIds: vi.fn(),
  product: vi.fn(),
  unit: vi.fn(),
  warehouse: vi.fn(),
  location: vi.fn(),
  supplier: vi.fn(),
  stock: vi.fn(),
  request: vi.fn()
}))

vi.mock("@/lib/auth", () => ({ getValidatedSession: mocks.session }))
vi.mock("@/lib/user-context", () => ({ getUserSecurityContext: mocks.ctx }))
vi.mock("@/lib/dal", () => ({ warehouseIdFilter: mocks.scope, getAccessibleWarehouseIds: mocks.warehouseIds }))
vi.mock("@/lib/db", () => ({
  db: {
    product: { findMany: mocks.product },
    productUnit: { findMany: mocks.unit },
    warehouse: { findMany: mocks.warehouse },
    warehouseLocation: { findMany: mocks.location },
    supplier: { findMany: mocks.supplier },
    stock: { findMany: mocks.stock },
    materialRequest: { findMany: mocks.request }
  }
}))

import { GET } from "@/app/api/offline/prepare/route"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ userId: "user-1", roles: ["ALMOXARIFE"], expiresAt: new Date("2030-01-01") })
  mocks.ctx.mockResolvedValue({ roleNames: ["ALMOXARIFE"], permissionKeys: new Set<string>(), status: "ACTIVE", mustChangePassword: false, allWarehouseAccess: false, sessionVersion: 0 })
  mocks.scope.mockResolvedValue({ warehouseId: { in: ["w-1"] } })
  mocks.warehouseIds.mockResolvedValue(["w-1"])
  for (const fn of [mocks.product, mocks.unit, mocks.warehouse, mocks.location, mocks.supplier, mocks.stock, mocks.request]) {
    fn.mockResolvedValue([])
  }
})

it("requires an authenticated session", async () => {
  mocks.session.mockResolvedValue(null)
  expect((await GET()).status).toBe(401)
  expect(mocks.product).not.toHaveBeenCalled()
})

it("only returns modules covered by the user's permissions", async () => {
  mocks.ctx.mockResolvedValue({ roleNames: ["ALMOXARIFE"], permissionKeys: new Set(["STOCK_VIEW"]), status: "ACTIVE", mustChangePassword: false, allWarehouseAccess: false, sessionVersion: 0 })
  const response = await GET()
  const body = await response.json()
  expect(body.modules.stock).toBeDefined()
  expect(body.modules.catalog).toBeUndefined()
  expect(body.modules.requests).toBeUndefined()
  expect(mocks.product).not.toHaveBeenCalled()
})

it("scopes warehouse-bound data to the user's access", async () => {
  mocks.ctx.mockResolvedValue({ roleNames: ["ALMOXARIFE"], permissionKeys: new Set(["PRODUCT_VIEW", "STOCK_VIEW"]), status: "ACTIVE", mustChangePassword: false, allWarehouseAccess: false, sessionVersion: 0 })
  const response = await GET()
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(mocks.stock).toHaveBeenCalledWith(expect.objectContaining({ where: { warehouseId: { in: ["w-1"] } } }))
  expect(mocks.warehouse).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ["w-1"] } }) }))
})

it("admins receive the full catalog without warehouse restriction", async () => {
  mocks.session.mockResolvedValue({ userId: "admin-1", roles: ["ADMIN"], expiresAt: new Date("2030-01-01") })
  mocks.ctx.mockResolvedValue({ roleNames: ["ADMIN"], permissionKeys: new Set<string>(), status: "ACTIVE", mustChangePassword: false, allWarehouseAccess: true, sessionVersion: 0 })
  mocks.scope.mockResolvedValue(undefined)
  mocks.warehouseIds.mockResolvedValue(null)
  const response = await GET()
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.modules.catalog).toBeDefined()
  expect(body.modules.stock).toBeDefined()
  expect(body.modules.requests).toBeDefined()
})
