"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { format } from "date-fns"
import { Prisma } from "@prisma/client"

export async function exportProductsData() {
  await requirePermission('REPORT_EXPORT')
  const products = await db.product.findMany({
    include: { category: true, unit: true },
    orderBy: { name: 'asc' }
  })
  return products.map(p => ({
    "Cód.Insumo": p.code,
    Nome: p.name,
    Categoria: p.category?.name || 'Sem categoria',
    Unidade: p.unit?.code || 'UN',
    Minimo: p.minimumStock || 0,
    Maximo: p.maximumStock || 0,
    Status: p.status === 'ACTIVE' ? 'Ativo' : 'Inativo'
  }))
}

export async function exportStockData() {
  await requirePermission('REPORT_EXPORT')
  const stock = await db.stock.findMany({
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

export async function exportMovementsData(startDate?: Date, endDate?: Date) {
  await requirePermission('REPORT_EXPORT')
  const whereClause: Prisma.StockMovementWhereInput = {}
  if (startDate && endDate) {
    whereClause.createdAt = { gte: new Date(startDate), lte: new Date(endDate) }
  }
  const movements = await db.stockMovement.findMany({
    where: whereClause,
    include: { product: true, warehouse: true, performedBy: true },
    orderBy: { createdAt: 'desc' }
  })
  
  return movements.map((m) => {
    let typeLabel = m.type
    if (m.type === 'ENTRY') typeLabel = 'Entrada'
    if (m.type === 'EXIT') typeLabel = 'Saída'
    if (m.type === 'ADJUSTMENT_IN') typeLabel = 'Ajuste In'
    if (m.type === 'ADJUSTMENT_OUT') typeLabel = 'Ajuste Out'
    if (m.type === 'RETURN') typeLabel = 'Devolução'
    if (m.type === 'TRANSFER_IN') typeLabel = 'Transf In'
    if (m.type === 'TRANSFER_OUT') typeLabel = 'Transf Out'
    
    return {
      Data: format(m.createdAt, "dd/MM/yyyy HH:mm"),
      Tipo: typeLabel,
      Produto: m.product.name,
      Quantidade: m.quantity,
      Almoxarifado: m.warehouse.name,
      Usuario: m.performedBy.name
    }
  })
}

export async function getInventoriesList() {
  await requirePermission('REPORT_EXPORT')
  return db.inventory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  })
}

export async function exportInventoryData(inventoryId: string) {
  await requirePermission('REPORT_EXPORT')
  const inv = await db.inventory.findUnique({
    where: { id: inventoryId },
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
    db.inventoryDivergence.findMany({ where: { inventoryId } })
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
        QtdSistema: expected,
        QtdContada: item.quantity,
        Divergencia: item.quantity - expected
      })
    })
  })
  return { name: inv.name, data }
}
