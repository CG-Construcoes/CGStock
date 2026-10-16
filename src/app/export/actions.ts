"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { format } from "date-fns"
import { getMovementTypeLabel } from "@/lib/movement-labels"
import { Prisma } from "@prisma/client"
import * as dal from "@/lib/dal"
import { warehouseIdFilter } from "@/lib/dal"

async function getExportWarehouseFilter(explicitWarehouseId?: string) {
  const baseFilter = await warehouseIdFilter()
  const cookieWhId = "getActiveWarehouseId" in dal && typeof dal.getActiveWarehouseId === "function"
    ? await dal.getActiveWarehouseId()
    : ""
  const targetWhId = explicitWarehouseId !== undefined ? (explicitWarehouseId === "ALL" ? "" : explicitWarehouseId) : cookieWhId

  if (!targetWhId) return baseFilter

  // Garante que o targetWhId está dentro do escopo permitido
  if (baseFilter?.warehouseId?.in && !baseFilter.warehouseId.in.includes(targetWhId)) {
    return baseFilter
  }

  return { warehouseId: { in: [targetWhId] } }
}

export async function getExportWarehousesAction() {
  await requirePermission('REPORT_EXPORT')
  const [warehouses, activeId] = await Promise.all([
    "getAccessibleWarehouses" in dal && typeof dal.getAccessibleWarehouses === "function" ? dal.getAccessibleWarehouses() : Promise.resolve([]),
    "getActiveWarehouseId" in dal && typeof dal.getActiveWarehouseId === "function" ? dal.getActiveWarehouseId() : Promise.resolve("")
  ])
  return { warehouses, activeWarehouseId: activeId }
}

export async function exportProductsData(warehouseId?: string) {
  await requirePermission('REPORT_EXPORT')
  const wFilter = await getExportWarehouseFilter(warehouseId)
  const products = await db.product.findMany({
    where: wFilter ? { stocks: { some: wFilter } } : undefined,
    include: { category: true, unit: true, stocks: { where: wFilter } },
    orderBy: { name: 'asc' }
  })
  return products.map(p => ({
    "Cód.Insumo": p.code,
    Nome: p.name,
    Categoria: p.category?.name || 'Sem categoria',
    Unidade: p.unit?.code || 'UN',
    Estoque: p.stocks ? p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0) : 0,
    Minimo: p.minimumStock || 0,
    Maximo: p.maximumStock || 0,
    Status: p.status === 'ACTIVE' ? 'Ativo' : 'Inativo'
  }))
}

export async function exportStockData(warehouseId?: string) {
  await requirePermission('REPORT_EXPORT')
  const stock = await db.stock.findMany({
    where: await getExportWarehouseFilter(warehouseId),
    include: { product: true, warehouse: true, location: true },
    orderBy: { product: { name: 'asc' } }
  })
  return stock.map((s) => ({
    "Cód.Insumo": s.product.code,
    Produto: s.product.name,
    Almoxarifado: s.warehouse.name,
    Localizacao: s.location.code,
    Quantidade: s.quantity
  }))
}

export async function exportMovementsData(startDate?: Date, endDate?: Date, warehouseId?: string) {
  await requirePermission('REPORT_EXPORT')
  const whereClause: Prisma.StockMovementWhereInput = { ...await getExportWarehouseFilter(warehouseId) }
  if (startDate && endDate) {
    whereClause.createdAt = { gte: new Date(startDate), lte: new Date(endDate) }
  }
  const movements = await db.stockMovement.findMany({
    where: whereClause,
    include: { product: true, warehouse: true, performedBy: true },
    orderBy: { createdAt: 'desc' }
  })
  
  return movements.map((m) => {
    const typeLabel = getMovementTypeLabel(m.type, m.referenceType)

    return {
      Data: format(m.createdAt, "dd/MM/yyyy HH:mm"),
      Tipo: typeLabel,
      Produto: m.product.name,
      Quantidade: Math.abs(Number(m.quantity)),
      Almoxarifado: m.warehouse.name,
      Usuario: m.performedBy.name
    }
  })
}

export async function getInventoriesList(warehouseId?: string) {
  await requirePermission('REPORT_EXPORT')
  return db.inventory.findMany({
    where: await getExportWarehouseFilter(warehouseId),
    orderBy: { createdAt: 'desc' },
    take: 20
  })
}

export async function exportInventoryData(inventoryId: string) {
  await requirePermission('REPORT_EXPORT')
  const inv = await db.inventory.findFirst({
    where: { id: inventoryId, ...await warehouseIdFilter() },
    include: {
      locations: {
        include: {
          location: true
        }
      }
    }
  })
  
  if (!inv) throw new Error("Inventário não encontrado")

  // Fetch collections to get the items
  const [collections, divergences] = await Promise.all([
    db.inventoryCollection.findMany({
      where: { inventoryId },
      include: { items: { include: { product: true } }, location: true }
    }),
    db.inventoryDivergence.findMany({ where: { inventoryId, countedQuantity: { gt: 0 } } })
  ])
  const expectedByLocationProduct = new Map(
    divergences.map(d => [`${d.locationId}:${d.productId}`, d.systemQuantity])
  )

  const data: Record<string, unknown>[] = []
  collections.forEach((col) => {
    col.items.forEach((item) => {
      // Sem divergência registrada, a quantidade esperada equivale à contada
      const expected = expectedByLocationProduct.get(`${col.locationId}:${item.productId}`) ?? item.quantity
      data.push({
        Inventario: inv.name,
        Data: format(inv.createdAt, "dd/MM/yyyy"),
        Local: col.location.code,
        "Cód.Insumo": item.product.code,
        Produto: item.product.name,
        QtdSistema: Number(expected),
        QtdContada: Number(item.quantity),
        Divergencia: Number(item.quantity) - Number(expected)
      })
    })
  })
  return { name: inv.name, data }
}
