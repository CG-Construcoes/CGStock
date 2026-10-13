import { expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ getSession: vi.fn().mockResolvedValue({ userId: "joao" }) }))
vi.mock("@/lib/permissions", () => ({ requirePermission: vi.fn() }))
vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: vi.fn().mockRejectedValue(new Error("Não autorizado")) }))
vi.mock("@/lib/db", () => ({ db: {
  product: { findUnique: vi.fn().mockResolvedValue({ defaultLocation: null, stocks: [{ warehouseId: "outro" }] }), update: vi.fn(), delete: vi.fn() }
} }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))

import { db } from "@/lib/db"
import { updateProductAction, deleteProduct } from "@/app/products/actions"

it("não altera nem exclui produto que afeta estoque de almoxarifado alheio", async () => {
  const data = new FormData()
  data.set("id", "p")
  await expect(updateProductAction(data)).rejects.toThrow("Não autorizado")
  await expect(deleteProduct("p")).rejects.toThrow("Não autorizado")
  expect(db.product.update).not.toHaveBeenCalled()
  expect(db.product.delete).not.toHaveBeenCalled()
})
