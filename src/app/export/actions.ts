"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { format } from "date-fns"
import { getMovementTypeLabel } from "@/lib/movement-labels"
import { Prisma } from "@prisma/client"
import * as dal from "@/lib/dal"
import { warehouseIdFilter } from "@/lib/dal"
import { buildInformakonRows, documentDigits } from "@/lib/informakon-export"
import { buildMovementsReportWhere } from "@/lib/movement-report-filters"
import { resolveWarehouseContext, warehouseScopeIds } from "@/lib/dal"
import { getValidatedSession } from "@/lib/auth"
import { productSearchWhere } from "@/lib/product-search"
import { PRODUCT_CHANGE_ACTIONS, changesFromMetadata } from "@/lib/product-changes"
import { PRODUCT_QUICK_EDIT_ACTION } from "@/lib/quick-edit"

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

/**
 * Exporta as movimentações com os MESMOS filtros aplicados nas páginas de
 * /reports/* (usa o mesmo builder do template — export bate com a tela).
 */
export async function exportFilteredMovementsData(filters: {
  typeFilter?: Prisma.StockMovementWhereInput["type"]
  warehouseId?: string
  q?: string
  categoryId?: string
  kind?: string
  personId?: string
  from?: string
  to?: string
}) {
  await requirePermission('REPORT_EXPORT')
  const session = await getValidatedSession()
  if (!session) throw new Error("Sessão inválida.")
  const { warehouseWhere: wFilter } = await resolveWarehouseContext(filters.warehouseId, session.userId)

  const { where } = buildMovementsReportWhere({
    typeFilter: filters.typeFilter,
    warehouseWhere: wFilter ?? undefined,
    q: filters.q,
    categoryId: filters.categoryId,
    kind: filters.kind,
    personId: filters.personId,
    from: filters.from,
    to: filters.to,
  })

  const movements = await db.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: {
      product: { select: { code: true, name: true, unit: { select: { code: true } } } },
      warehouse: { select: { name: true } },
      location: { select: { code: true } },
      performedBy: { select: { name: true } },
      recipientUser: { select: { name: true } },
    },
  })

  return movements.map((m) => ({
    Data: format(m.createdAt, "dd/MM/yyyy HH:mm"),
    Tipo: getMovementTypeLabel(m.type, m.referenceType),
    "Cód.Insumo": m.product.code,
    Produto: m.product.name,
    Quantidade: m.type === "EDIT" ? "" : Math.abs(Number(m.quantity)),
    Unidade: m.product.unit?.code ?? "",
    Almoxarifado: m.warehouse.name,
    Local: m.location.code,
    Documento: m.documentNumber ?? "",
    Motivo: m.reason ?? "",
    Usuario: m.performedBy.name,
    Destinatario: m.recipientUser?.name ?? "",
  }))
}

/** Exporta as alterações de cadastro de produto (mesma tela de /reports/changes). */
export async function exportProductChangesData(filters: { q?: string; userId?: string; productId?: string; from?: string; to?: string }) {
  await requirePermission('REPORT_EXPORT')
  const session = await getValidatedSession()
  if (!session) throw new Error("Sessão inválida.")

  const q = filters.q?.trim() || ""
  const from = filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from) ? filters.from : ""
  const to = filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to) ? filters.to : ""

  const scope = await warehouseScopeIds(session.userId)
  const productWhere: Prisma.ProductWhereInput = {
    ...(productSearchWhere(q) ?? {}),
    ...(scope ? { stocks: { some: { warehouseId: { in: scope } } } } : {}),
  }
  const restrictProducts = !!(q || scope)
  const productIds = filters.productId
    ? [filters.productId]
    : restrictProducts ? (await db.product.findMany({ where: productWhere, select: { id: true } })).map(p => p.id) : null

  const where: Prisma.AuditLogWhereInput = {
    entityType: "Product",
    action: { in: PRODUCT_CHANGE_ACTIONS },
    ...(productIds ? { entityId: { in: productIds } } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(from || to ? { timestamp: { ...(from ? { gte: new Date(`${from}T00:00:00-03:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999-03:00`) } : {}) } } : {}),
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: 10_000,
    include: { user: { select: { name: true } } },
  })
  const products = await db.product.findMany({
    where: { id: { in: [...new Set(logs.map(l => l.entityId))] } },
    select: { id: true, code: true, name: true },
  })
  const productById = new Map(products.map(p => [p.id, p]))

  return logs.map(log => {
    const product = productById.get(log.entityId)
    return {
      Data: format(log.timestamp, "dd/MM/yyyy HH:mm"),
      "Cód.Insumo": product?.code ?? "",
      Produto: product?.name ?? "Produto removido",
      Alteracao: changesFromMetadata(log.action, log.metadata).map(c => `${c.label}: ${c.from} → ${c.to}`).join("; "),
      Usuario: log.user.name,
      Origem: log.action === PRODUCT_QUICK_EDIT_ACTION ? "Edição rápida" : "Tela de edição",
    }
  })
}

/** Exporta a posição de estoque detalhada (mesma tela de /reports/stock). */
export async function exportStockPositionData(warehouseId?: string) {
  await requirePermission('REPORT_EXPORT')
  const session = await getValidatedSession()
  if (!session) throw new Error("Sessão inválida.")
  const { warehouseWhere: wFilter } = await resolveWarehouseContext(warehouseId, session.userId)

  const stocks = await db.stock.findMany({
    where: wFilter,
    orderBy: [{ product: { name: 'asc' } }, { location: { code: 'asc' } }],
    take: 20_000,
    include: {
      product: { include: { category: true, unit: true } },
      warehouse: true,
      location: true,
    },
  })
  return stocks.map(s => ({
    "Cód.Insumo": s.product.code,
    Produto: s.product.name,
    Categoria: s.product.category?.name ?? "",
    Unidade: s.product.unit?.code ?? "",
    Almoxarifado: s.warehouse.name,
    Local: s.location.code,
    Quantidade: Number(s.quantity),
    Reservado: Number(s.reservedQuantity),
    Disponivel: Number(s.quantity) - Number(s.reservedQuantity),
  }))
}

/** Exporta o ranking de consumo (mesma tela de /reports/consumption). */
export async function exportConsumptionData(warehouseId?: string) {
  await requirePermission('REPORT_EXPORT')
  const session = await getValidatedSession()
  if (!session) throw new Error("Sessão inválida.")
  const { warehouseWhere: wFilter } = await resolveWarehouseContext(warehouseId, session.userId)
  const where = wFilter ? { request: wFilter } : {}

  const consumption = await db.materialRequestItem.groupBy({
    by: ['productId'],
    where,
    _sum: { deliveredQuantity: true },
    orderBy: { _sum: { deliveredQuantity: 'desc' } },
    take: 500,
  })
  const products = await db.product.findMany({
    where: { id: { in: consumption.map(c => c.productId) } },
    include: { unit: true, category: true },
  })
  const byId = new Map(products.map(p => [p.id, p]))

  return consumption
    .map((c, i) => ({ c, product: byId.get(c.productId), rank: i + 1 }))
    .filter(({ c, product }) => product && Number(c._sum.deliveredQuantity) > 0)
    .map(({ c, product, rank }) => ({
      Rank: rank,
      "Cód.Insumo": product!.code,
      Produto: product!.name,
      Categoria: product!.category?.name ?? "",
      "Total Consumido": Number(c._sum.deliveredQuantity),
      Unidade: product!.unit?.code ?? "",
    }))
}

/** Exporta a lista de inventários (mesma tela de /reports/inventory). */
export async function exportInventoriesData(warehouseId?: string) {
  await requirePermission('REPORT_EXPORT')
  const session = await getValidatedSession()
  if (!session) throw new Error("Sessão inválida.")
  const { warehouseWhere: wFilter } = await resolveWarehouseContext(warehouseId, session.userId)

  const inventories = await db.inventory.findMany({
    where: wFilter,
    orderBy: { createdAt: 'desc' },
    take: 5_000,
    include: {
      warehouse: true,
      createdBy: true,
      _count: { select: { divergences: true, locations: true, collections: true } },
    },
  })
  return inventories.map(inv => ({
    Codigo: inv.code,
    Nome: inv.name,
    Data: format(inv.createdAt, "dd/MM/yyyy"),
    Almoxarifado: inv.warehouse.name,
    Status: inv.status,
    Locais: inv._count.locations,
    Coletas: inv._count.collections,
    Divergencias: inv._count.divergences,
    CriadoPor: inv.createdBy.name,
  }))
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

/**
 * Dados para as planilhas de importação do Informakon (Entradas e Saídas),
 * no layout exato dos modelos ModeloImportacaoEntradas/Saidas.xls.
 */
export async function exportInformakonData(fromDate: string, toDate: string, warehouseId?: string) {
  await requirePermission('REPORT_EXPORT')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw new Error("Informe o período (data inicial e final).")
  }
  // Limites do dia no fuso de Brasília (UTC-3)
  const where: Prisma.StockMovementWhereInput = {
    ...await getExportWarehouseFilter(warehouseId),
    createdAt: { gte: new Date(`${fromDate}T00:00:00-03:00`), lte: new Date(`${toDate}T23:59:59.999-03:00`) },
  }
  const movements = await db.stockMovement.findMany({
    where,
    select: {
      id: true, type: true, referenceType: true, referenceId: true, documentNumber: true, quantity: true,
      unitCost: true, totalCost: true, reason: true, notes: true, createdAt: true,
      product: { select: { code: true, name: true } },
      warehouse: { select: { code: true, name: true } },
      recipientUser: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Ajustes de inventário não têm Nº Documento: usa o código do inventário de origem
  const divergenceIds = movements.filter(m => m.referenceType === 'INVENTORY_ADJUSTMENT' && m.referenceId).map(m => m.referenceId!)
  const divergences = divergenceIds.length
    ? await db.inventoryDivergence.findMany({ where: { id: { in: divergenceIds } }, select: { id: true, inventory: { select: { code: true } } } })
    : []
  const invCodeByDivergence = new Map(divergences.map(d => [d.id, documentDigits(d.inventory.code)]))
  const fallbackDocs = new Map<string, string>()
  for (const m of movements) {
    const doc = m.referenceId ? invCodeByDivergence.get(m.referenceId) : undefined
    if (doc) fallbackDocs.set(m.id, doc)
  }

  return buildInformakonRows(movements.map(m => ({
    id: m.id,
    type: m.type,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    documentNumber: m.documentNumber,
    quantity: Number(m.quantity),
    unitCost: m.unitCost != null ? Number(m.unitCost) : null,
    totalCost: m.totalCost != null ? Number(m.totalCost) : null,
    reason: m.reason,
    notes: m.notes,
    createdAt: m.createdAt,
    productCode: m.product.code,
    productName: m.product.name,
    warehouseCode: m.warehouse.code,
    warehouseName: m.warehouse.name,
    recipientName: m.recipientUser?.name ?? null,
  })), fallbackDocs)
}
