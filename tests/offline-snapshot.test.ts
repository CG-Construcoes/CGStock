import { describe, expect, it } from "vitest"
import { getProductStockOffline, isCollectorSnapshotUsable, isSnapshotUsable } from "@/lib/offline-snapshot"
import type { CatalogSnapshotData, CollectorSnapshot, StockSnapshotData } from "@/lib/localdb"

const now = new Date("2026-10-13T10:00:00.000Z").getTime()
const snapshot: CollectorSnapshot = {
  id: "user-a:collector", userId: "user-a", module: "collector", downloadedAt: new Date(now),
  expiresAt: new Date(now + 3600000), data: { products: [], inventories: [] }
}

describe("prepared collector access", () => {
  it("requires the same authenticated user", () => {
    expect(isCollectorSnapshotUsable(snapshot, "user-a", new Date(now + 7200000).toISOString(), now)).toBe(true)
    expect(isCollectorSnapshotUsable(snapshot, "user-b", new Date(now + 7200000).toISOString(), now)).toBe(false)
  })

  it("expires when either the snapshot or the session expires", () => {
    expect(isCollectorSnapshotUsable(snapshot, "user-a", new Date(now + 7200000).toISOString(), now + 3600000)).toBe(false)
    expect(isCollectorSnapshotUsable(snapshot, "user-a", new Date(now + 60000).toISOString(), now + 60000)).toBe(false)
    expect(isCollectorSnapshotUsable(snapshot, "user-a", "invalid", now)).toBe(false)
  })
})

describe("generic module snapshots", () => {
  it("applies the same ownership and expiry rules to any module", () => {
    const other = { userId: "user-a", expiresAt: new Date(now + 3600000) }
    expect(isSnapshotUsable(other, "user-a", new Date(now + 7200000).toISOString(), now)).toBe(true)
    expect(isSnapshotUsable(other, "user-b", new Date(now + 7200000).toISOString(), now)).toBe(false)
    expect(isSnapshotUsable(undefined, "user-a", new Date(now + 7200000).toISOString(), now)).toBe(false)
  })
})

describe("getProductStockOffline com códigos duplicados", () => {
  // Catálogo importado por empresa pode repetir o mesmo código em produtos
  // distintos. A consulta deve preferir o gêmeo com saldo no almoxarifado.
  const catalog: CatalogSnapshotData = {
    products: [
      { id: "p-psc", code: "000118-000", barcode: null, name: "LÁPIS P/ CARPINTEIRO", unitCode: "UN", categoryName: null },
      { id: "p-mahay", code: "000118-000", barcode: null, name: "LÁPIS P/ CARPINTEIRO", unitCode: "UN", categoryName: null },
    ],
    warehouses: [
      { id: "wh-psc", code: "PSC-01-0011", name: "Ousy - Obra" },
      { id: "wh-mahay", code: "ALM-MAHAY", name: "Mahay" },
    ],
    locations: [
      { id: "loc-psc", warehouseId: "wh-psc", code: "A1", name: "A1" },
      { id: "loc-mahay", warehouseId: "wh-mahay", code: "B1", name: "B1" },
    ],
    suppliers: [],
    units: [],
  }
  const stock: StockSnapshotData = {
    items: [
      { productId: "p-psc", warehouseId: "wh-psc", locationId: "loc-psc", quantity: 26, reservedQuantity: 0 },
      { productId: "p-mahay", warehouseId: "wh-mahay", locationId: "loc-mahay", quantity: 51, reservedQuantity: 0 },
    ],
  }

  it("escolhe o produto gêmeo que tem saldo no almoxarifado consultado", () => {
    const mahay = getProductStockOffline(catalog, stock, "wh-mahay", "000118-000")
    expect("error" in mahay).toBe(false)
    if ("error" in mahay) return
    expect(mahay.product.id).toBe("p-mahay")
    expect(mahay.totalAvailable).toBe(51)

    const psc = getProductStockOffline(catalog, stock, "wh-psc", "000118-000")
    expect("error" in psc).toBe(false)
    if ("error" in psc) return
    expect(psc.product.id).toBe("p-psc")
    expect(psc.totalAvailable).toBe(26)
  })

  it("informa onde há saldo quando o almoxarifado atual está zerado", () => {
    const other: CatalogSnapshotData = {
      ...catalog,
      warehouses: [...catalog.warehouses, { id: "wh-central", code: "ALM-CENTRAL", name: "Almoxarifado Central" }],
    }
    const res = getProductStockOffline(other, stock, "wh-central", "000118-000")
    expect("error" in res).toBe(true)
    if ("error" in res) expect(res.error).toContain("Ousy - Obra")
  })
})
