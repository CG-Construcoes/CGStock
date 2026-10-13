import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ session: vi.fn(), permission: vi.fn(), inventories: vi.fn(), products: vi.fn(), scope: vi.fn() }))
vi.mock("@/lib/auth", () => ({ getValidatedSession: mocks.session }))
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.permission }))
vi.mock("@/lib/dal", () => ({ warehouseIdFilter: mocks.scope }))
vi.mock("@/lib/db", () => ({ db: { inventory: { findMany: mocks.inventories }, product: { findMany: mocks.products } } }))

import { GET } from "@/app/api/offline/collector/route"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ userId: "collector-1", roles: ["COLETOR"], expiresAt: new Date("2030-01-01") })
  mocks.permission.mockResolvedValue(true)
  mocks.scope.mockResolvedValue({ warehouseId: { in: ["warehouse-1"] } })
  mocks.inventories.mockResolvedValue([])
  mocks.products.mockResolvedValue([])
})

it("never downloads a catalog for someone without count permission", async () => {
  mocks.permission.mockResolvedValue(false)
  expect((await GET()).status).toBe(403)
  expect(mocks.products).not.toHaveBeenCalled()
})

it("downloads only inventories assigned to the user inside the warehouse scope", async () => {
  const response = await GET()
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(mocks.inventories).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({
      warehouseId: { in: ["warehouse-1"] },
      operators: { some: { userId: "collector-1" } }
    })
  }))
  expect((await response.json()).userId).toBe("collector-1")
})
