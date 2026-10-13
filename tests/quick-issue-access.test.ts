import { expect, it, vi } from "vitest"

vi.mock("@/lib/action-guard", () => ({ requireActionPermission: vi.fn().mockResolvedValue({ userId: "operador" }) }))
vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: vi.fn().mockRejectedValue(new Error("Não autorizado")), warehouseScopeIds: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: {
  warehouse: { findFirst: vi.fn().mockResolvedValue({ id: "outro", worksiteId: "obra" }) },
  stock: { findMany: vi.fn() },
  product: { findFirst: vi.fn() }
} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { db } from "@/lib/db"
import { getProductStockForQuickIssue } from "@/app/quick-issue/actions"

it("acesso à obra não autoriza consulta ao estoque de almoxarifado não atribuído", async () => {
  expect(await getProductStockForQuickIssue("obra", "outro", "ABC")).toEqual({ error: "Você não tem acesso a este almoxarifado." })
  expect(db.stock.findMany).not.toHaveBeenCalled()
})
