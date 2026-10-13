import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { getUserSecurityContext } from "@/lib/user-context"
import { warehouseIdFilter, getAccessibleWarehouseIds } from "@/lib/dal"
import type { PermissionKey } from "@/lib/permissions"

const CATALOG_KEYS: PermissionKey[] = ['PRODUCT_VIEW', 'STOCK_ENTRY', 'STOCK_EXIT', 'STOCK_TRANSFER', 'REQUEST_CREATE', 'INVENTORY_COUNT']
const REQUEST_KEYS: PermissionKey[] = ['REQUEST_CREATE', 'REQUEST_APPROVE', 'REQUEST_FULFILL']

const LIMITS = { products: 5000, units: 500, warehouses: 500, locations: 5000, suppliers: 500, stock: 20000, requests: 200 }

/**
 * Download autorizado dos dados necessários para operação offline.
 * Cada módulo é incluído somente se o usuário tiver a permissão
 * correspondente, e dados por almoxarifado seguem o escopo do usuário.
 */
export async function GET() {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 })

  const ctx = await getUserSecurityContext(session.userId)
  if (!ctx) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 })

  const isAdmin = ctx.roleNames.includes('ADMIN')
  const can = (key: PermissionKey) => isAdmin || ctx.permissionKeys.has(key)
  const canAny = (keys: PermissionKey[]) => isAdmin || keys.some(k => ctx.permissionKeys.has(k))

  const modules: Record<string, unknown> = {}
  const wFilter = await warehouseIdFilter(session.userId)

  if (canAny(CATALOG_KEYS)) {
    const scopeIds = await getAccessibleWarehouseIds(session.userId)
    const [products, units, warehouses, locations, suppliers] = await Promise.all([
      db.product.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, code: true, barcode: true, name: true, unit: { select: { code: true } }, category: { select: { name: true } } },
        orderBy: { id: 'asc' },
        take: LIMITS.products + 1
      }),
      db.productUnit.findMany({ where: { status: 'ACTIVE' }, select: { id: true, code: true, name: true }, take: LIMITS.units + 1 }),
      db.warehouse.findMany({
        where: { status: 'ACTIVE', ...(scopeIds ? { id: { in: scopeIds } } : {}) },
        select: { id: true, code: true, name: true },
        take: LIMITS.warehouses + 1
      }),
      db.warehouseLocation.findMany({
        where: { status: 'ACTIVE', ...wFilter },
        select: { id: true, warehouseId: true, code: true, name: true },
        take: LIMITS.locations + 1
      }),
      db.supplier.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, take: LIMITS.suppliers + 1 })
    ])

    if (products.length > LIMITS.products || locations.length > LIMITS.locations) {
      return NextResponse.json({ error: "Catálogo grande demais para preparar neste dispositivo. Contate o administrador." }, { status: 413 })
    }

    modules.catalog = {
      products: products.map(p => ({ id: p.id, code: p.code, barcode: p.barcode, name: p.name, unitCode: p.unit.code, categoryName: p.category.name })),
      warehouses,
      locations,
      suppliers,
      units
    }
  }

  if (can('STOCK_VIEW')) {
    const stock = await db.stock.findMany({
      where: wFilter,
      select: { productId: true, warehouseId: true, locationId: true, quantity: true, reservedQuantity: true },
      take: LIMITS.stock + 1
    })
    if (stock.length > LIMITS.stock) {
      return NextResponse.json({ error: "Volume de estoque grande demais para preparar neste dispositivo." }, { status: 413 })
    }
    modules.stock = { items: stock }
  }

  if (canAny(REQUEST_KEYS)) {
    const seesAll = can('REQUEST_APPROVE') || can('REQUEST_FULFILL')
    const requests = await db.materialRequest.findMany({
      where: seesAll
        ? { OR: [{ requesterId: session.userId }, { status: { in: ['PENDING_APPROVAL', 'APPROVED', 'IN_SEPARATION', 'PARTIALLY_FULFILLED'] }, ...wFilter }] }
        : { requesterId: session.userId },
      select: { id: true, requestNumber: true, status: true, createdAt: true, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      take: LIMITS.requests + 1
    })
    modules.requests = {
      items: requests.slice(0, LIMITS.requests).map(r => ({
        id: r.id, requestNumber: r.requestNumber, status: r.status,
        createdAt: r.createdAt.toISOString(), itemCount: r._count.items
      }))
    }
  }

  return NextResponse.json({
    userId: session.userId,
    expiresAt: session.expiresAt,
    modules
  }, { headers: { 'Cache-Control': 'no-store' } })
}
