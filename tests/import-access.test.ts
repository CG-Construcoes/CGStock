import { beforeEach, expect, it, vi } from "vitest"

vi.mock("@/lib/action-guard", () => ({ requireActionPermission: vi.fn().mockResolvedValue({ userId: "operador" }) }))
vi.mock("@/lib/dal", () => ({ assertWarehouseAccess: vi.fn() }))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: { importBatch: { create: vi.fn().mockResolvedValue({ id: "batch" }) } } }))

import { db } from "@/lib/db"
import { assertWarehouseAccess } from "@/lib/dal"
import { createImportBatchAction } from "@/app/import/actions"

beforeEach(() => vi.clearAllMocks())

it("importação rejeita destino fora do acesso antes de criar lote", async () => {
  vi.mocked(assertWarehouseAccess).mockRejectedValueOnce(new Error("Não autorizado"))
  await expect(createImportBatchAction("outro", [{ productCode: "ABC", quantity: 1 }])).rejects.toThrow("Não autorizado")
  expect(db.importBatch.create).not.toHaveBeenCalled()
})

it("importação preserva fluxo existente para almoxarifado autorizado", async () => {
  expect(await createImportBatchAction("central", [{ productCode: "ABC", productName: "Produto", quantity: 2 }])).toEqual({ success: true, batchId: "batch" })
  expect(db.importBatch.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ warehouseId: "central", createdById: "operador" }) }))
})
