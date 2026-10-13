import { beforeEach, expect, it, vi } from "vitest"

vi.mock("@/lib/action-guard", () => ({ requireAdmin: vi.fn().mockResolvedValue({ userId: "admin" }) }))
vi.mock("@/lib/audit", () => ({ logAuditStrict: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect") }) }))
const tx = vi.hoisted(() => ({
  user: { update: vi.fn() },
  userWorksiteAccess: { deleteMany: vi.fn(), createMany: vi.fn() },
  userWarehouseAccess: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() }
}))
vi.mock("@/lib/db", () => ({ db: {
  user: { findUnique: vi.fn() },
  warehouse: { count: vi.fn() },
  $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx))
} }))

import { db } from "@/lib/db"
import { editUserAction } from "@/app/admin/users/[id]/edit/actions"

function form(mode: string) {
  const data = new FormData()
  data.set("id", "joao")
  data.set("name", "João")
  data.set("email", "joao@example.com")
  data.set("roleIds", "role-stock")
  data.set("warehouseAccessMode", mode)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.user.findUnique).mockImplementation(({ where }) =>
    Promise.resolve(where.id ? { roles: [{ id: "role-stock" }], worksiteAccesses: [] } : null) as never)
  tx.userWarehouseAccess.findMany.mockResolvedValue([{ warehouseId: "central" }])
})

it("modo ALL preserva vínculos individuais antigos e não invalida sessão", async () => {
  await expect(editUserAction(null, form("ALL"))).rejects.toThrow("redirect")
  expect(tx.userWarehouseAccess.deleteMany).not.toHaveBeenCalled()
  expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ allWarehouseAccess: true, sessionVersion: undefined }) }))
})

it("ID adulterado é rejeitado antes de alterar usuário", async () => {
  vi.mocked(db.warehouse.count).mockResolvedValue(0)
  const data = form("SELECTED")
  data.set("warehouseIds", "inexistente")
  expect(await editUserAction(null, data)).toEqual({ error: "A seleção contém um almoxarifado inválido." })
  expect(tx.user.update).not.toHaveBeenCalled()
})
