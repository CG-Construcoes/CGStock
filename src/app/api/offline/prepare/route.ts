import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { getUserSecurityContext } from "@/lib/user-context"
import { warehouseIdFilter, getAccessibleWarehouseIds } from "@/lib/dal"
import type { PermissionKey } from "@/lib/permissions"
import { OFFLINE_MIN_TTL_MS } from "@/lib/offline-snapshot"

const CATALOG_KEYS: PermissionKey[] = ['PRODUCT_VIEW', 'STOCK_ENTRY', 'STOCK_EXIT', 'STOCK_TRANSFER', 'REQUEST_CREATE', 'INVENTORY_COUNT', 'INVENTORY_CREATE']
const REQUEST_KEYS: PermissionKey[] = ['REQUEST_CREATE', 'REQUEST_APPROVE', 'REQUEST_FULFILL']
const OPERATIONS_KEYS: PermissionKey[] = ['STOCK_VIEW', 'STOCK_ENTRY', 'STOCK_EXIT', 'STOCK_TRANSFER', 'INVENTORY_CREATE', 'INVENTORY_COUNT', 'INVENTORY_REVIEW', 'INVENTORY_APPROVE']

const LIMITS = {
  products: 5000,
  units: 500,
  warehouses: 500,
  locations: 5000,
  suppliers: 500,
  stock: 20000,
  requests: 200,
  employees: 2000,
  movements: 200,
  receipts: 100,
  transfers: 100,
  returns: 100,
  inventories: 100,
}

/**
 * Download autorizado dos dados necessários para operação 100% offline.
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
  const dbAny = db as unknown as Record<string, { findMany?: (...args: unknown[]) => Promise<unknown[]> } | undefined>

  if (canAny(CATALOG_KEYS)) {
    const scopeIds = await getAccessibleWarehouseIds(session.userId)
    const canSeeEmployees = canAny(['STOCK_EXIT', 'USER_VIEW', 'USER_MANAGE', 'INVENTORY_CREATE'])

    const [products, units, warehouses, locations, suppliers, categories, employees, worksites] = await Promise.all([
      db.product.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          code: true,
          barcode: true,
          name: true,
          unitId: true,
          categoryId: true,
          minimumStock: true,
          maximumStock: true,
          averageCost: true,
          status: true,
          unit: { select: { code: true } },
          category: { select: { name: true } }
        },
        orderBy: { id: 'asc' },
        take: LIMITS.products + 1
      }),
      db.productUnit.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, code: true, name: true, status: true },
        take: LIMITS.units + 1
      }),
      db.warehouse.findMany({
        where: { status: 'ACTIVE', ...(scopeIds ? { id: { in: scopeIds } } : {}) },
        select: { id: true, code: true, name: true, worksiteId: true, description: true, status: true },
        take: LIMITS.warehouses + 1
      }),
      db.warehouseLocation.findMany({
        where: { status: 'ACTIVE', ...wFilter },
        select: { id: true, warehouseId: true, code: true, name: true, description: true, status: true },
        take: LIMITS.locations + 1
      }),
      db.supplier.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, document: true, status: true },
        take: LIMITS.suppliers + 1
      }),
      dbAny.productCategory?.findMany
        ? db.productCategory.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, description: true, status: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
      canSeeEmployees && dbAny.user?.findMany
        ? db.user.findMany({
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              name: true,
              email: true,
              employeeCode: true,
              document: true,
              qrToken: true,
              qrStatus: true,
              status: true,
              roles: { select: { name: true } },
              worksiteAccesses: {
                include: {
                  worksite: { select: { id: true, code: true, name: true, status: true } }
                }
              }
            },
            take: LIMITS.employees
          })
        : Promise.resolve([]),
      canSeeEmployees && dbAny.worksite?.findMany
        ? db.worksite.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, code: true, name: true, status: true }
          })
        : Promise.resolve([]),
    ])

    if (products.length > LIMITS.products || locations.length > LIMITS.locations) {
      return NextResponse.json({ error: "Catálogo grande demais para preparar neste dispositivo. Contate o administrador." }, { status: 413 })
    }

    const mappedEmployees = (employees as {
      id: string
      name: string
      email?: string | null
      employeeCode?: string | null
      document?: string | null
      qrToken?: string | null
      qrStatus: string
      status: string
      roles?: { name: string }[]
      worksiteAccesses?: { worksite: { id: string; code?: string | null; name: string; status: string } }[]
    }[]).map(emp => ({
      id: emp.id,
      name: emp.name,
      email: emp.email ?? null,
      employeeCode: emp.employeeCode ?? null,
      document: emp.document ?? null,
      qrToken: emp.qrToken ?? null,
      qrStatus: emp.qrStatus,
      status: emp.status,
      roles: (emp.roles ?? []).map(r => r.name),
      worksites: (emp.worksiteAccesses ?? []).map(wa => wa.worksite),
    }))

    const operators = mappedEmployees
      .filter(emp => emp.roles.some(r => ['ADMIN', 'GESTOR', 'ALMOXARIFE', 'AUX. ALMOXARIFADO', 'CONFERENTE'].includes(r)) || emp.roles.length > 0)
      .map(emp => ({ id: emp.id, name: emp.name, email: emp.email, roles: emp.roles }))

    modules.catalog = {
      products: products.map(p => ({
        id: p.id,
        code: p.code,
        barcode: p.barcode,
        name: p.name,
        unitId: p.unitId,
        unitCode: p.unit?.code ?? null,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        minimumStock: Number(p.minimumStock ?? 0),
        maximumStock: Number(p.maximumStock ?? 0),
        averageCost: p.averageCost != null ? Number(p.averageCost) : null,
        status: p.status ?? 'ACTIVE',
      })),
      warehouses,
      locations,
      suppliers,
      units,
      categories,
      employees: mappedEmployees,
      worksites,
      operators,
    }
  }

  if (can('STOCK_VIEW') || canAny(['STOCK_EXIT', 'STOCK_ENTRY', 'STOCK_TRANSFER', 'INVENTORY_COUNT'])) {
    // Mantém compatibilidade estrita com testes que verificam STOCK_VIEW quando nenhum outro módulo está ativo
    if (can('STOCK_VIEW') || canAny(CATALOG_KEYS)) {
      const stock = await db.stock.findMany({
        where: wFilter,
        select: { productId: true, warehouseId: true, locationId: true, quantity: true, reservedQuantity: true },
        take: LIMITS.stock + 1
      })
      if (stock.length > LIMITS.stock) {
        return NextResponse.json({ error: "Volume de estoque grande demais para preparar neste dispositivo." }, { status: 413 })
      }
      if (can('STOCK_VIEW')) {
        modules.stock = {
          items: stock.map(s => ({
            productId: s.productId,
            warehouseId: s.warehouseId,
            locationId: s.locationId,
            quantity: Number(s.quantity),
            reservedQuantity: Number(s.reservedQuantity ?? 0),
          }))
        }
      }
    }
  }

  if (canAny(REQUEST_KEYS)) {
    const seesAll = can('REQUEST_APPROVE') || can('REQUEST_FULFILL')
    const requests = await db.materialRequest.findMany({
      where: seesAll
        ? { OR: [{ requesterId: session.userId }, { status: { in: ['PENDING_APPROVAL', 'APPROVED', 'IN_SEPARATION', 'PARTIALLY_FULFILLED'] }, ...wFilter }] }
        : { requesterId: session.userId },
      select: {
        id: true,
        requestNumber: true,
        status: true,
        priority: true,
        notes: true,
        warehouseId: true,
        requesterId: true,
        createdAt: true,
        requestedAt: true,
        fulfilledAt: true,
        warehouse: { select: { name: true } },
        requester: { select: { name: true } },
        approvedBy: { select: { name: true } },
        approvedAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            unitId: true,
            requestedQuantity: true,
            approvedQuantity: true,
            deliveredQuantity: true,
            product: { select: { code: true, name: true } },
            unit: { select: { code: true } },
          }
        },
        _count: { select: { items: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: LIMITS.requests + 1
    })
    modules.requests = {
      items: requests.slice(0, LIMITS.requests).map(r => ({
        id: r.id,
        requestNumber: r.requestNumber,
        status: r.status,
        priority: r.priority ?? 'NORMAL',
        notes: r.notes ?? null,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse?.name ?? '',
        requesterId: r.requesterId,
        requesterName: r.requester?.name ?? '',
        approvedByName: r.approvedBy?.name ?? null,
        approvedAt: r.approvedAt ? new Date(r.approvedAt).toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        requestedAt: r.requestedAt ? new Date(r.requestedAt).toISOString() : null,
        fulfilledAt: r.fulfilledAt ? new Date(r.fulfilledAt).toISOString() : null,
        itemCount: r._count?.items ?? (Array.isArray(r.items) ? r.items.length : 0),
        items: Array.isArray(r.items)
          ? r.items.map(it => ({
              id: it.id,
              productId: it.productId,
              productCode: it.product?.code ?? '',
              productName: it.product?.name ?? '',
              unitId: it.unitId,
              unitCode: it.unit?.code ?? 'UN',
              requestedQuantity: Number(it.requestedQuantity ?? 0),
              approvedQuantity: Number(it.approvedQuantity ?? 0),
              deliveredQuantity: Number(it.deliveredQuantity ?? 0),
            }))
          : undefined,
      }))
    }
  }

  // Inclui módulo do Coletor automaticamente se o usuário tiver permissão de contagem e db.inventory estiver disponível
  if (canAny(['INVENTORY_COUNT', 'INVENTORY_CREATE', 'INVENTORY_REVIEW', 'INVENTORY_APPROVE']) && dbAny.inventory?.findMany) {
    const isAdminOrManager = ctx.roleNames.some(r => ['ADMIN', 'GESTOR'].includes(r))
    const activeInvs = await db.inventory.findMany({
      where: {
        status: 'IN_PROGRESS',
        ...wFilter,
        ...(isAdminOrManager ? {} : { operators: { some: { userId: session.userId } } })
      },
      include: {
        warehouse: { select: { name: true } },
        locations: {
          where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
          include: { location: true }
        }
      },
      take: 500
    })

    const catalogData = modules.catalog as { products?: { id: string; code: string; barcode: string | null; name: string; unitCode: string | null }[] } | undefined
    const stockData = modules.stock as { items?: { productId: string; locationId: string; quantity: number }[] } | undefined
    const stocksByProduct = new Map<string, Record<string, number>>()
    for (const s of stockData?.items ?? []) {
      const map = stocksByProduct.get(s.productId) ?? {}
      map[s.locationId] = Number(s.quantity)
      stocksByProduct.set(s.productId, map)
    }

    modules.collector = {
      products: (catalogData?.products ?? []).map(p => ({
        id: p.id,
        code: p.code,
        barcode: p.barcode,
        name: p.name,
        ...(p.unitCode ? { unitCode: p.unitCode } : {}),
        locationStocks: stocksByProduct.get(p.id) ?? {},
      })),
      inventories: activeInvs.map(inv => ({
        id: inv.id,
        code: inv.code,
        name: inv.name,
        status: inv.status,
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse?.name,
        locations: inv.locations.map(item => ({ id: item.locationId, code: item.location.code, status: item.status }))
      }))
    }
  }

  // Módulo de operações recentes (movimentações, entradas, transferências, devoluções, inventários) para consultas offline
  if (canAny(OPERATIONS_KEYS) && (dbAny.stockMovement?.findMany || dbAny.stockReceipt?.findMany || dbAny.inventory?.findMany)) {
    const scopeIds = await getAccessibleWarehouseIds(session.userId)
    const trFilter = scopeIds
      ? { sourceWarehouseId: { in: scopeIds }, destinationWarehouseId: { in: scopeIds } }
      : undefined

    const [movements, receipts, transfers, returns, inventories] = await Promise.all([
      dbAny.stockMovement?.findMany
        ? db.stockMovement.findMany({
            where: wFilter,
            include: {
              product: { select: { code: true, name: true, unit: { select: { code: true } } } },
              location: { select: { code: true, warehouse: { select: { name: true } } } },
              performedBy: { select: { name: true } },
              recipientUser: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: LIMITS.movements,
          })
        : Promise.resolve([]),
      dbAny.stockReceipt?.findMany
        ? db.stockReceipt.findMany({
            where: wFilter,
            include: {
              supplier: { select: { name: true, document: true } },
              warehouse: { select: { name: true, code: true } },
              createdBy: { select: { name: true, email: true } },
              items: {
                include: {
                  product: { select: { code: true, name: true, unit: { select: { code: true } } } },
                  location: { select: { code: true, name: true } },
                }
              },
              _count: { select: { items: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: LIMITS.receipts,
          })
        : Promise.resolve([]),
      dbAny.stockTransfer?.findMany
        ? db.stockTransfer.findMany({
            where: trFilter,
            include: {
              sourceWarehouse: { select: { name: true } },
              sourceLocation: { select: { code: true } },
              destinationWarehouse: { select: { name: true } },
              destinationLocation: { select: { code: true } },
              createdBy: { select: { name: true } },
              _count: { select: { items: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: LIMITS.transfers,
          })
        : Promise.resolve([]),
      dbAny.materialReturn?.findMany
        ? db.materialReturn.findMany({
            where: wFilter,
            include: {
              warehouse: { select: { name: true } },
              request: { select: { requestNumber: true } },
              returnedBy: { select: { name: true } },
              _count: { select: { items: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: LIMITS.returns,
          })
        : Promise.resolve([]),
      dbAny.inventory?.findMany
        ? db.inventory.findMany({
            where: wFilter,
            include: {
              warehouse: { select: { name: true } },
              createdBy: { select: { name: true } },
              locations: { include: { location: { select: { code: true } } } },
              operators: { include: { user: { select: { name: true, email: true } } } },
              collections: {
                include: {
                  operator: { select: { name: true } },
                  location: { select: { code: true } },
                  _count: { select: { items: true } },
                }
              },
            },
            orderBy: { createdAt: 'desc' },
            take: LIMITS.inventories,
          })
        : Promise.resolve([]),
    ])

    modules.operations = {
      movements: movements.map(m => ({
        id: m.id,
        productId: m.productId,
        productCode: m.product.code,
        productName: m.product.name,
        unitCode: m.product.unit.code,
        warehouseId: m.warehouseId,
        warehouseName: m.location.warehouse.name,
        locationId: m.locationId,
        locationCode: m.location.code,
        type: m.type,
        quantity: Number(m.quantity),
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        documentNumber: m.documentNumber,
        performedByName: m.performedBy.name,
        recipientName: m.recipientUser?.name ?? null,
        reason: m.reason,
        notes: m.notes,
        createdAt: m.createdAt.toISOString(),
      })),
      receipts: receipts.map(r => ({
        id: r.id,
        documentNumber: r.documentNumber,
        documentDate: r.documentDate ? r.documentDate.toISOString() : null,
        receivedAt: r.receivedAt ? r.receivedAt.toISOString() : null,
        status: r.status,
        supplierId: r.supplierId,
        supplierName: r.supplier.name,
        supplierDocument: r.supplier.document,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse.name,
        warehouseCode: r.warehouse.code,
        createdByName: r.createdBy.name,
        createdByEmail: r.createdBy.email,
        total: Number(r.total ?? 0),
        itemCount: r._count.items,
        createdAt: r.createdAt.toISOString(),
        items: r.items.map(it => ({
          id: it.id,
          productId: it.productId,
          productCode: it.product.code,
          productName: it.product.name,
          unitCode: it.product.unit.code,
          locationId: it.locationId,
          locationCode: it.location.code,
          locationName: it.location.name,
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost ?? 0),
          totalCost: Number(it.totalCost ?? 0),
        })),
      })),
      transfers: transfers.map(t => ({
        id: t.id,
        transferNumber: t.transferNumber,
        status: t.status,
        sourceWarehouseId: t.sourceWarehouseId,
        sourceWarehouseName: t.sourceWarehouse.name,
        sourceLocationId: t.sourceLocationId,
        sourceLocationCode: t.sourceLocation.code,
        destinationWarehouseId: t.destinationWarehouseId,
        destinationWarehouseName: t.destinationWarehouse.name,
        destinationLocationId: t.destinationLocationId,
        destinationLocationCode: t.destinationLocation.code,
        createdByName: t.createdBy.name,
        itemCount: t._count.items,
        createdAt: t.createdAt.toISOString(),
      })),
      returns: returns.map(ret => ({
        id: ret.id,
        returnNumber: ret.returnNumber,
        status: ret.status,
        warehouseId: ret.warehouseId,
        warehouseName: ret.warehouse.name,
        requestId: ret.requestId,
        requestNumber: ret.request?.requestNumber ?? null,
        returnedByName: ret.returnedBy.name,
        reason: ret.reason,
        itemCount: ret._count.items,
        createdAt: ret.createdAt.toISOString(),
      })),
      inventories: inventories.map(inv => ({
        id: inv.id,
        code: inv.code,
        name: inv.name,
        type: inv.type,
        status: inv.status,
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        createdByName: inv.createdBy.name,
        startedAt: inv.startedAt ? inv.startedAt.toISOString() : null,
        finishedAt: inv.finishedAt ? inv.finishedAt.toISOString() : null,
        locations: inv.locations.map(l => ({
          id: l.id,
          locationId: l.locationId,
          code: l.location.code,
          status: l.status,
        })),
        operators: inv.operators.map(o => ({
          userId: o.userId,
          name: o.user.name,
          email: o.user.email,
        })),
        collections: inv.collections.map(c => ({
          id: c.id,
          locationId: c.locationId,
          locationCode: c.location.code,
          operatorName: c.operator.name,
          itemCount: c._count.items,
          startedAt: c.startedAt ? c.startedAt.toISOString() : null,
        })),
      })),
    }
  }

  const effectiveExpiresAt = new Date(
    Math.max(new Date(session.expiresAt).getTime(), Date.now() + OFFLINE_MIN_TTL_MS)
  )

  return NextResponse.json({
    userId: session.userId,
    expiresAt: effectiveExpiresAt,
    modules
  }, { headers: { 'Cache-Control': 'no-store' } })
}
