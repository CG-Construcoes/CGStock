"use server"

import { db } from "@/lib/db"
import { requireAnyPermission, resolveWarehouseContext } from "@/lib/dal"

export type ProductLookupLocation = {
  warehouseName: string
  locationCode: string
  locationName: string
  quantity: number
  reservedQuantity: number
  unitValue: number | null
}

export type ProductLookupMovement = {
  id: string
  type: string
  referenceType: string | null
  quantity: number
  createdAt: string
  documentNumber: string | null
  locationCode: string
  performedByName: string
  recipientName: string | null
}

export type ProductLookupData = {
  id: string
  code: string
  barcode: string | null
  name: string
  status: string
  categoryName: string
  unitCode: string
  unitName: string
  brand: string | null
  model: string | null
  notes: string | null
  minimumStock: number
  maximumStock: number
  averageCost: number | null
  defaultLocationLabel: string | null
  totalQuantity: number
  totalReserved: number
  available: number
  totalValue: number
  locations: ProductLookupLocation[]
  movements: ProductLookupMovement[]
}

export type ProductLookupResponse =
  | { success: true; product: ProductLookupData; warehouseLabel: string }
  | { error: string }

export async function lookupProductAction(rawCode: string): Promise<ProductLookupResponse> {
  const code = rawCode.trim()
  if (!code) return { error: "Informe o código do produto ou escaneie a etiqueta." }
  if (/^EMP-/i.test(code)) {
    return { error: "Este QR Code é de um crachá de funcionário, não de uma etiqueta de produto." }
  }

  try {
    await requireAnyPermission("STOCK_VIEW", "PRODUCT_VIEW")
  } catch {
    return { error: "Você não tem permissão para consultar produtos." }
  }

  const { warehouses, selectedWarehouseId, effectiveScopeIds, warehouseWhere } =
    await resolveWarehouseContext(undefined)

  const warehouseLabel = selectedWarehouseId
    ? warehouses.find((w) => w.id === selectedWarehouseId)?.name ?? "Almoxarifado selecionado"
    : warehouses.length > 0
      ? `Todos os almoxarifados (${warehouses.length})`
      : "Nenhum almoxarifado autorizado"

  const include = {
    category: true,
    unit: true,
    defaultLocation: { include: { warehouse: true } },
    stocks: {
      where: warehouseWhere,
      select: {
        id: true,
        quantity: true,
        reservedQuantity: true,
        location: { include: { warehouse: true } },
      },
      orderBy: { quantity: "desc" as const },
    },
    movements: {
      where: warehouseWhere,
      orderBy: { createdAt: "desc" as const },
      take: 5,
      include: { performedBy: true, recipientUser: true, location: true },
    },
  }

  // QR das etiquetas carrega o código do insumo; aceita também código de
  // barras, ID interno e, como fallback, busca parcial (digitação manual).
  const product =
    (await db.product.findFirst({
      where: {
        OR: [
          { code: { equals: code, mode: "insensitive" } },
          { barcode: { equals: code, mode: "insensitive" } },
          { id: code },
        ],
      },
      include,
    })) ??
    (await db.product.findFirst({
      where: {
        OR: [
          { code: { contains: code, mode: "insensitive" } },
          { barcode: { contains: code, mode: "insensitive" } },
          { name: { contains: code, mode: "insensitive" } },
        ],
      },
      orderBy: { code: "asc" },
      include,
    }))

  if (!product) {
    return { error: `Nenhum produto encontrado para "${code}". Confira o código ou a etiqueta.` }
  }

  const averageCost = product.averageCost === null ? null : Number(product.averageCost)
  const totalQuantity = product.stocks.reduce((sum, s) => sum + Number(s.quantity), 0)
  const totalReserved = product.stocks.reduce((sum, s) => sum + Number(s.reservedQuantity), 0)
  const totalValue = product.stocks.reduce(
    (sum, s) => sum + Number(s.quantity) * Number(averageCost ?? 0),
    0
  )

  const defaultLocationVisible =
    product.defaultLocation &&
    (effectiveScopeIds === null || effectiveScopeIds.includes(product.defaultLocation.warehouseId))

  return {
    success: true,
    warehouseLabel,
    product: {
      id: product.id,
      code: product.code,
      barcode: product.barcode,
      name: product.name,
      status: product.status,
      categoryName: product.category.name,
      unitCode: product.unit.code,
      unitName: product.unit.name,
      brand: product.brand,
      model: product.model,
      notes: product.notes,
      minimumStock: product.minimumStock,
      maximumStock: product.maximumStock,
      averageCost,
      defaultLocationLabel: defaultLocationVisible
        ? `${product.defaultLocation!.warehouse.name} · ${product.defaultLocation!.code}`
        : null,
      totalQuantity,
      totalReserved,
      available: totalQuantity - totalReserved,
      totalValue,
      locations: product.stocks.map((s) => ({
        warehouseName: s.location.warehouse.name,
        locationCode: s.location.code,
        locationName: s.location.name,
        quantity: Number(s.quantity),
        reservedQuantity: Number(s.reservedQuantity),
        unitValue: averageCost,
      })),
      movements: product.movements.map((m) => ({
        id: m.id,
        type: m.type,
        referenceType: m.referenceType,
        quantity: Number(m.quantity),
        createdAt: m.createdAt.toISOString(),
        documentNumber: m.documentNumber,
        locationCode: m.location.code,
        performedByName: m.performedBy.name,
        recipientName: m.recipientUser?.name ?? null,
      })),
    },
  }
}
