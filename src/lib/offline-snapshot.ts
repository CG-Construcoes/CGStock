import {
  localDb,
  type OfflineSnapshot,
  type CatalogSnapshotData,
  type StockSnapshotData,
  type RequestsSnapshotData,
  type OperationsSnapshotData,
  type CollectorSnapshotData,
  type SyncOperationType,
} from "@/lib/localdb"

/**
 * Janela mínima garantida para operação offline contínua (72h > 48h mínimo exigido).
 * Mesmo após esse período, os dados locais e a fila de sincronização NUNCA são
 * apagados nem bloqueados enquanto o dispositivo estiver sem internet.
 */
export const OFFLINE_MIN_TTL_MS = 72 * 60 * 60 * 1000 // 72 horas
export const OFFLINE_PAGE_CACHE_NAME = "cgstock-pages-v1"

export function computeSnapshotExpiry(serverExpiresAt?: string | Date | null, now = Date.now()): Date {
  const minExpiry = now + OFFLINE_MIN_TTL_MS
  if (!serverExpiresAt) return new Date(minExpiry)
  const parsed = new Date(serverExpiresAt).getTime()
  if (!Number.isFinite(parsed)) return new Date(minExpiry)
  return new Date(Math.max(parsed, minExpiry))
}

export async function getOfflineSnapshot<T>(module: string, userId: string): Promise<OfflineSnapshot<T> | undefined> {
  if (!localDb) return undefined
  return (await localDb.snapshots.get(`${userId}:${module}`)) as OfflineSnapshot<T> | undefined
}

export async function saveOfflineSnapshot<T>(module: string, userId: string, data: T, expiresAt: Date): Promise<OfflineSnapshot<T>> {
  if (!localDb) throw new Error("Armazenamento local indisponível neste navegador.")
  const snapshot: OfflineSnapshot<T> = {
    id: `${userId}:${module}`,
    userId,
    module,
    downloadedAt: new Date(),
    expiresAt,
    data
  }
  await localDb.snapshots.put(snapshot)
  return snapshot
}

export async function clearOfflineSnapshots(userId: string) {
  if (localDb) {
    await localDb.snapshots.where('userId').equals(userId).delete()
    await localDb.collectorDrafts.where('userId').equals(userId).delete()
  }
  if (typeof window !== 'undefined' && 'caches' in window) {
    await caches.delete(OFFLINE_PAGE_CACHE_NAME).catch(() => {})
  }
}

export function isSnapshotUsable(snapshot: { userId: string; expiresAt: Date } | undefined, userId: string, sessionExpiresAt: string, now = Date.now()) {
  return !!snapshot && snapshot.userId === userId &&
    Number.isFinite(new Date(sessionExpiresAt).getTime()) &&
    now < Math.min(new Date(snapshot.expiresAt).getTime(), new Date(sessionExpiresAt).getTime())
}

export const isCollectorSnapshotUsable = isSnapshotUsable

/**
 * Em modo offline real, nunca bloqueia o trabalho do almoxarife nem descarta
 * dados caso o período de 48h/72h tenha sido ultrapassado.
 * Exige apenas que o snapshot pertença ao usuário autenticado.
 */
export function isSnapshotAvailableOffline(
  snapshot: { userId: string; expiresAt: Date } | undefined,
  userId: string
): boolean {
  return !!snapshot && snapshot.userId === userId
}

export function isSnapshotStale(
  snapshot: { expiresAt: Date } | undefined,
  now = Date.now()
): boolean {
  if (!snapshot) return true
  return now >= new Date(snapshot.expiresAt).getTime()
}

/**
 * Resolve funcionário localmente (QR Code do crachá/capacete, matrícula, CPF, e-mail ou ID)
 * reproduzindo exatamente as regras de `verifyEmployeeQR` no servidor.
 */
export function resolveEmployeeOffline(
  qrInput: string,
  catalog: CatalogSnapshotData | undefined,
  activeWarehouseId?: string
) {
  const trimmed = qrInput.trim()
  if (!trimmed) return { error: "Informe o código ou escaneie o QR Code do colaborador." }

  const employees = catalog?.employees ?? []
  if (employees.length === 0) {
    // Fallback se a lista de funcionários ainda não estiver no snapshot
    const fallbackWh = (activeWarehouseId ? catalog?.warehouses?.find(w => w.id === activeWarehouseId) : undefined) ?? catalog?.warehouses?.[0]
    const fallbackWs = catalog?.worksites?.[0]
    return {
      success: true,
      unverifiedOffline: true,
      employee: {
        id: trimmed,
        name: `Colaborador (${trimmed})`,
        email: null,
        employeeCode: trimmed,
        document: null,
      },
      worksite: {
        id: fallbackWs?.id || fallbackWh?.worksiteId || "",
        name: fallbackWs?.name || "Validação na sincronização",
      },
      warehouse: {
        id: fallbackWh?.id || "",
        name: fallbackWh?.name || "Almoxarifado padrão",
      },
      qrToken: trimmed,
    }
  }

  const lower = trimmed.toLowerCase()
  const cleanDigits = trimmed.replace(/\D/g, "")
  const withoutEmpPrefix = trimmed.replace(/^EMP-/i, "").toLowerCase()

  const employee = employees.find((emp) => {
    if (emp.qrToken && emp.qrToken.toLowerCase() === lower) return true
    if (emp.qrToken && emp.qrToken.toLowerCase() === `emp-${lower}`) return true
    if (emp.employeeCode && emp.employeeCode.toLowerCase() === lower) return true
    if (emp.employeeCode && emp.employeeCode.toLowerCase() === withoutEmpPrefix) return true
    if (emp.email && emp.email.toLowerCase() === lower) return true
    if (emp.id.toLowerCase() === lower) return true
    if (cleanDigits.length >= 8 && emp.document) {
      const empDigits = emp.document.replace(/\D/g, "")
      if (empDigits === cleanDigits || emp.document.toLowerCase() === lower) return true
    }
    return false
  })

  if (!employee) {
    return { error: "Funcionário não encontrado ou código inválido." }
  }
  if (employee.status !== "ACTIVE") {
    return { error: "Funcionário inativo." }
  }
  if (employee.qrToken && employee.qrToken.toLowerCase() === lower && employee.qrStatus !== "ACTIVE") {
    return { error: "QR Code revogado." }
  }

  const warehouses = catalog?.warehouses ?? []
  let warehouse = activeWarehouseId
    ? warehouses.find((w) => w.id === activeWarehouseId && w.status !== "INACTIVE")
    : undefined

  let worksite: { id: string; code?: string | null; name: string; status: string } | null =
    employee.worksites?.find((w) => w.status === "ACTIVE") || employee.worksites?.[0] || null

  if (!warehouse && worksite) {
    warehouse = warehouses.find((w) => w.worksiteId === worksite!.id && w.status !== "INACTIVE")
  }
  if (!warehouse && warehouses.length > 0) {
    warehouse = warehouses.find((w) => w.status !== "INACTIVE") ?? warehouses[0]
  }

  if (!warehouse) {
    return { error: "Nenhum almoxarifado ativo encontrado neste aparelho." }
  }

  worksite = {
    id: warehouse.worksiteId || worksite?.id || warehouse.id,
    name: warehouse.name,
    status: "ACTIVE",
  }

  return {
    success: true,
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email ?? null,
      employeeCode: employee.employeeCode ?? null,
      document: employee.document ?? null,
    },
    worksite: {
      id: worksite.id,
      name: worksite.name,
    },
    warehouse: {
      id: warehouse.id,
      name: warehouse.name,
    },
    qrToken: employee.qrToken || employee.employeeCode || trimmed,
  }
}

/**
 * Consulta produto e saldo de estoque localmente no IndexedDB para Entrega Rápida e demais telas.
 */
export function getProductStockOffline(
  catalog: CatalogSnapshotData | undefined,
  stock: StockSnapshotData | undefined,
  warehouseId: string,
  productCode: string
) {
  const trimmed = productCode.trim()
  if (!trimmed) return { error: "Informe o código do produto." }
  const products = catalog?.products ?? []
  const lower = trimmed.toLowerCase()

  const exact = products.find(
    (p) => p.code.toLowerCase() === lower || (p.barcode && p.barcode.toLowerCase() === lower)
  )
  const partial =
    exact ||
    products
      .filter(
        (p) =>
          p.code.toLowerCase().includes(lower) ||
          (p.barcode && p.barcode.toLowerCase().includes(lower)) ||
          p.name.toLowerCase().includes(lower)
      )
      .sort((a, b) => a.code.localeCompare(b.code))[0]

  if (!partial) {
    return { error: "Produto não encontrado no catálogo." }
  }

  const locationsById = new Map((catalog?.locations ?? []).map((l) => [l.id, l]))
  const stockItems = (stock?.items ?? []).filter(
    (s) =>
      s.productId === partial.id &&
      (!warehouseId || s.warehouseId === warehouseId) &&
      Number(s.quantity) > 0
  )

  if (stock && stock.items.length > 0 && stockItems.length === 0) {
    return { error: "Este produto não possui estoque disponível neste almoxarifado." }
  }

  const totalAvailable =
    stock && stock.items.length > 0
      ? stockItems.reduce((sum, s) => sum + Number(s.quantity), 0)
      : null

  return {
    success: true,
    product: {
      id: partial.id,
      code: partial.code,
      name: partial.name,
      unit: partial.unitCode || "UN",
    },
    totalAvailable,
    locations: stockItems
      .map((s) => ({
        locationId: s.locationId,
        locationCode: locationsById.get(s.locationId)?.code || s.locationId,
        quantity: Number(s.quantity),
      }))
      .sort((a, b) => b.quantity - a.quantity),
  }
}

/**
 * Atualiza otimisticamente os snapshots locais no IndexedDB após enfileirar uma operação offline,
 * garantindo que consultas, saldos, inventários e movimentações reflitam imediatamente a operação.
 */
export async function applyOfflineOperationLocally(
  operation: SyncOperationType,
  payload: Record<string, unknown>,
  userId: string,
  entityId: string
) {
  if (!localDb || !userId) return

  try {
    const [catalogSnap, stockSnap, opsSnap, reqSnap, colSnap] = await Promise.all([
      getOfflineSnapshot<CatalogSnapshotData>("catalog", userId),
      getOfflineSnapshot<StockSnapshotData>("stock", userId),
      getOfflineSnapshot<OperationsSnapshotData>("operations", userId),
      getOfflineSnapshot<RequestsSnapshotData>("requests", userId),
      getOfflineSnapshot<CollectorSnapshotData>("collector", userId),
    ])

    const catalog = catalogSnap?.data
    const productsById = new Map((catalog?.products ?? []).map((p) => [p.id, p]))
    const productsByCode = new Map<string, (typeof catalog extends undefined ? never : NonNullable<typeof catalog>["products"][number])>()
    for (const p of catalog?.products ?? []) {
      productsByCode.set(p.code.toLowerCase(), p)
      if (p.barcode) productsByCode.set(p.barcode.toLowerCase(), p)
    }
    const warehousesById = new Map((catalog?.warehouses ?? []).map((w) => [w.id, w]))
    const locationsById = new Map((catalog?.locations ?? []).map((l) => [l.id, l]))
    const suppliersById = new Map((catalog?.suppliers ?? []).map((s) => [s.id, s]))

    const stockItems = stockSnap?.data?.items ? [...stockSnap.data.items.map((i) => ({ ...i }))] : []
    const ops: OperationsSnapshotData = opsSnap?.data
      ? {
          movements: [...(opsSnap.data.movements ?? [])],
          receipts: [...(opsSnap.data.receipts ?? [])],
          transfers: [...(opsSnap.data.transfers ?? [])],
          returns: [...(opsSnap.data.returns ?? [])],
          inventories: [...(opsSnap.data.inventories ?? [])],
        }
      : { movements: [], receipts: [], transfers: [], returns: [], inventories: [] }

    let stockModified = false
    let opsModified = false
    let reqModified = false
    let colModified = false

    const adjustLocalStock = (productId: string, warehouseId: string, locationId: string, delta: number) => {
      if (!productId || !locationId || !Number.isFinite(delta) || delta === 0) return
      const existing = stockItems.find((s) => s.productId === productId && s.locationId === locationId)
      if (existing) {
        existing.quantity = Math.max(0, Number((Number(existing.quantity) + delta).toFixed(4)))
      } else if (delta > 0) {
        stockItems.push({
          productId,
          warehouseId: warehouseId || locationsById.get(locationId)?.warehouseId || "",
          locationId,
          quantity: Number(delta.toFixed(4)),
          reservedQuantity: 0,
        })
      }
      stockModified = true

      if (colSnap?.data?.products) {
        const colProd = colSnap.data.products.find((p) => p.id === productId)
        if (colProd) {
          colProd.locationStocks = colProd.locationStocks || {}
          colProd.locationStocks[locationId] = Math.max(
            0,
            Number(((colProd.locationStocks[locationId] || 0) + delta).toFixed(4))
          )
          colModified = true
        }
      }
    }

    const addLocalMovement = (params: {
      productId: string
      warehouseId: string
      locationId: string
      type: string
      quantity: number
      referenceType?: string
      documentNumber?: string | null
      reason?: string | null
    }) => {
      const prod = productsById.get(params.productId)
      const loc = locationsById.get(params.locationId)
      const wh = warehousesById.get(params.warehouseId || loc?.warehouseId || "")
      ops.movements.unshift({
        id: `offline-mov-${entityId}-${Math.random().toString(36).slice(2, 7)}`,
        productId: params.productId,
        productCode: prod?.code || params.productId,
        productName: prod?.name || "Produto",
        unitCode: prod?.unitCode || "UN",
        warehouseId: params.warehouseId || loc?.warehouseId || "",
        warehouseName: wh?.name || "Almoxarifado",
        locationId: params.locationId,
        locationCode: loc?.code || "LOCAL",
        type: params.type,
        quantity: params.quantity,
        referenceType: params.referenceType || null,
        referenceId: entityId,
        documentNumber: params.documentNumber || null,
        performedByName: "Você (Offline)",
        reason: params.reason || null,
        createdAt: new Date().toISOString(),
        offlinePending: true,
      })
      opsModified = true
    }

    const nowIso = new Date().toISOString()

    if (operation === "CREATE_QUICK_ISSUE") {
      const qrToken = String(payload.qrToken || "")
      const resolved = resolveEmployeeOffline(qrToken, catalog, typeof payload.warehouseId === "string" ? payload.warehouseId : undefined)
      const warehouseId =
        (typeof payload.warehouseId === "string" && payload.warehouseId) ||
        (resolved.success ? resolved.warehouse.id : "") ||
        catalog?.warehouses?.[0]?.id ||
        ""
      const items = Array.isArray(payload.items) ? (payload.items as { productCode?: string; productId?: string; quantity?: number }[]) : []

      for (const item of items) {
        const qty = Number(item.quantity || 0)
        if (qty <= 0) continue
        const prod =
          (item.productId ? productsById.get(item.productId) : undefined) ||
          (item.productCode ? productsByCode.get(String(item.productCode).toLowerCase()) : undefined)
        if (!prod) continue

        const prodStocks = stockItems
          .filter((s) => s.productId === prod.id && (!warehouseId || s.warehouseId === warehouseId) && s.quantity > 0)
          .sort((a, b) => b.quantity - a.quantity)

        let remaining = qty
        if (prodStocks.length > 0) {
          for (const st of prodStocks) {
            if (remaining <= 0) break
            const take = Math.min(st.quantity, remaining)
            adjustLocalStock(prod.id, st.warehouseId, st.locationId, -take)
            addLocalMovement({
              productId: prod.id,
              warehouseId: st.warehouseId,
              locationId: st.locationId,
              type: "EXIT",
              quantity: take,
              referenceType: "QUICK_ISSUE",
              documentNumber: "ENT-OFFLINE",
              reason: "Entrega rápida (offline)",
            })
            remaining -= take
          }
        } else {
          const fallbackLoc = catalog?.locations?.find((l) => l.warehouseId === warehouseId)?.id || ""
          addLocalMovement({
            productId: prod.id,
            warehouseId,
            locationId: fallbackLoc,
            type: "EXIT",
            quantity: qty,
            referenceType: "QUICK_ISSUE",
            documentNumber: "ENT-OFFLINE",
            reason: "Entrega rápida (offline)",
          })
        }
      }
    } else if (operation === "CREATE_RECEIPT") {
      const warehouseId = String(payload.warehouseId || "")
      const supplierId = String(payload.supplierId || "")
      const actionType = String(payload.actionType || "DRAFT")
      const documentNumber = payload.documentNumber ? String(payload.documentNumber) : null
      const documentDate = payload.documentDate ? String(payload.documentDate) : null
      const items = Array.isArray(payload.items)
        ? (payload.items as { productId: string; locationId: string; quantity: number; unitCost: number }[])
        : []

      let total = 0
      const receiptItems = items.map((it, idx) => {
        const q = Number(it.quantity || 0)
        const c = Number(it.unitCost || 0)
        const tc = q * c
        total += tc
        const prod = productsById.get(it.productId)
        const loc = locationsById.get(it.locationId)
        if (actionType === "COMPLETED") {
          adjustLocalStock(it.productId, warehouseId, it.locationId, q)
          addLocalMovement({
            productId: it.productId,
            warehouseId,
            locationId: it.locationId,
            type: "ENTRY",
            quantity: q,
            referenceType: "RECEIPT",
            documentNumber,
          })
        }
        return {
          id: `${entityId}-item-${idx}`,
          productId: it.productId,
          productCode: prod?.code || "",
          productName: prod?.name || "Produto",
          unitCode: prod?.unitCode || "UN",
          locationId: it.locationId,
          locationCode: loc?.code || "",
          locationName: loc?.name || "",
          quantity: q,
          unitCost: c,
          totalCost: tc,
        }
      })

      ops.receipts.unshift({
        id: entityId,
        documentNumber,
        documentDate,
        receivedAt: actionType === "COMPLETED" ? nowIso : null,
        status: actionType,
        supplierId,
        supplierName: suppliersById.get(supplierId)?.name || "Fornecedor",
        warehouseId,
        warehouseName: warehousesById.get(warehouseId)?.name || "Almoxarifado",
        total,
        itemCount: items.length,
        createdAt: nowIso,
        items: receiptItems,
        offlinePending: true,
      })
      opsModified = true
    } else if (operation === "CONFIRM_RECEIPT") {
      const receiptId = String(payload.receiptId || "")
      const rec = ops.receipts.find((r) => r.id === receiptId)
      if (rec && rec.status === "DRAFT") {
        rec.status = "COMPLETED"
        rec.receivedAt = nowIso
        rec.offlinePending = true
        for (const item of rec.items ?? []) {
          adjustLocalStock(item.productId, rec.warehouseId, item.locationId, item.quantity)
          addLocalMovement({
            productId: item.productId,
            warehouseId: rec.warehouseId,
            locationId: item.locationId,
            type: "ENTRY",
            quantity: item.quantity,
            referenceType: "RECEIPT",
            documentNumber: rec.documentNumber,
          })
        }
        opsModified = true
      }
    } else if (operation === "CREATE_ADJUSTMENT") {
      const warehouseId = String(payload.warehouseId || "")
      const locationId = String(payload.locationId || "")
      const productId = String(payload.productId || "")
      const type = String(payload.type || "ADJUSTMENT_IN")
      const quantity = Number(payload.quantity || 0)
      const reason = String(payload.reason || "Ajuste Manual")
      const delta = type === "ADJUSTMENT_OUT" ? -quantity : quantity
      adjustLocalStock(productId, warehouseId, locationId, delta)
      addLocalMovement({
        productId,
        warehouseId,
        locationId,
        type,
        quantity,
        referenceType: "INVENTORY_ADJUSTMENT",
        reason,
      })
    } else if (operation === "CREATE_TRANSFER") {
      const sourceLocationId = String(payload.sourceLocationId || "")
      const destinationLocationId = String(payload.destinationLocationId || "")
      const sourceLoc = locationsById.get(sourceLocationId)
      const destLoc = locationsById.get(destinationLocationId)
      const items = Array.isArray(payload.items) ? (payload.items as { productId: string; quantity: number }[]) : []

      for (const item of items) {
        const qty = Number(item.quantity || 0)
        adjustLocalStock(item.productId, sourceLoc?.warehouseId || "", sourceLocationId, -qty)
        adjustLocalStock(item.productId, destLoc?.warehouseId || "", destinationLocationId, qty)
        addLocalMovement({
          productId: item.productId,
          warehouseId: sourceLoc?.warehouseId || "",
          locationId: sourceLocationId,
          type: "TRANSFER_OUT",
          quantity: qty,
          referenceType: "TRANSFER",
          documentNumber: "TRF-OFFLINE",
        })
        addLocalMovement({
          productId: item.productId,
          warehouseId: destLoc?.warehouseId || "",
          locationId: destinationLocationId,
          type: "TRANSFER_IN",
          quantity: qty,
          referenceType: "TRANSFER",
          documentNumber: "TRF-OFFLINE",
        })
      }

      ops.transfers.unshift({
        id: entityId,
        transferNumber: `TRF-OFF-${entityId.slice(0, 4).toUpperCase()}`,
        status: "COMPLETED",
        sourceWarehouseId: sourceLoc?.warehouseId || "",
        sourceWarehouseName: warehousesById.get(sourceLoc?.warehouseId || "")?.name || "Origem",
        sourceLocationId,
        sourceLocationCode: sourceLoc?.code || "",
        destinationWarehouseId: destLoc?.warehouseId || "",
        destinationWarehouseName: warehousesById.get(destLoc?.warehouseId || "")?.name || "Destino",
        destinationLocationId,
        destinationLocationCode: destLoc?.code || "",
        createdByName: "Você (Offline)",
        itemCount: items.length,
        createdAt: nowIso,
        offlinePending: true,
      })
      opsModified = true
    } else if (operation === "CREATE_RETURN") {
      const warehouseId = String(payload.warehouseId || "")
      const requestId = payload.requestId ? String(payload.requestId) : null
      const reason = payload.reason ? String(payload.reason) : null
      const items = Array.isArray(payload.items)
        ? (payload.items as { productId: string; locationId: string; quantity: number; condition: string }[])
        : []

      for (const item of items) {
        const qty = Number(item.quantity || 0)
        if (item.condition === "GOOD") {
          adjustLocalStock(item.productId, warehouseId, item.locationId, qty)
          addLocalMovement({
            productId: item.productId,
            warehouseId,
            locationId: item.locationId,
            type: "RETURN",
            quantity: qty,
            referenceType: "MATERIAL_RETURN",
            documentNumber: "RET-OFFLINE",
            reason,
          })
        }
      }

      ops.returns.unshift({
        id: entityId,
        returnNumber: `RET-OFF-${entityId.slice(0, 4).toUpperCase()}`,
        status: "RECEIVED",
        warehouseId,
        warehouseName: warehousesById.get(warehouseId)?.name || "Almoxarifado",
        requestId,
        requestNumber: reqSnap?.data?.items?.find((r) => r.id === requestId)?.requestNumber || null,
        returnedByName: "Você (Offline)",
        reason,
        itemCount: items.length,
        createdAt: nowIso,
        offlinePending: true,
      })
      opsModified = true
    } else if (operation === "CREATE_REQUEST") {
      const warehouseId = String(payload.warehouseId || "")
      const priority = String(payload.priority || "NORMAL")
      const notes = payload.notes ? String(payload.notes) : null
      const actionType = String(payload.actionType || "PENDING_APPROVAL")
      const items = Array.isArray(payload.items)
        ? (payload.items as { productId: string; unitId: string; requestedQuantity: number }[])
        : []

      const reqItems = items.map((it, idx) => {
        const prod = productsById.get(it.productId)
        return {
          id: `${entityId}-reqitem-${idx}`,
          productId: it.productId,
          productCode: prod?.code || "",
          productName: prod?.name || "Produto",
          unitId: it.unitId,
          unitCode: prod?.unitCode || "UN",
          requestedQuantity: Number(it.requestedQuantity || 0),
          approvedQuantity: 0,
          deliveredQuantity: 0,
        }
      })

      const currentRequests = reqSnap?.data?.items ? [...reqSnap.data.items] : []
      currentRequests.unshift({
        id: entityId,
        requestNumber: `REQ-OFF-${entityId.slice(0, 4).toUpperCase()}`,
        status: actionType,
        priority,
        notes,
        warehouseId,
        warehouseName: warehousesById.get(warehouseId)?.name || "Almoxarifado",
        requesterId: userId,
        requesterName: "Você (Offline)",
        createdAt: nowIso,
        requestedAt: actionType === "PENDING_APPROVAL" ? nowIso : null,
        itemCount: items.length,
        items: reqItems,
        offlinePending: true,
      })
      await saveOfflineSnapshot<RequestsSnapshotData>(
        "requests",
        userId,
        { items: currentRequests },
        reqSnap?.expiresAt || computeSnapshotExpiry()
      )
      reqModified = false // already saved
    } else if (operation === "REQUEST_STATUS" && reqSnap?.data?.items) {
      const requestId = String(payload.requestId || "")
      const action = String(payload.action || "")
      const currentRequests = reqSnap.data.items.map((r) => {
        if (r.id !== requestId) return r
        const nextStatus =
          action === "APPROVE"
            ? "APPROVED"
            : action === "REJECT"
            ? "REJECTED"
            : action === "CANCEL"
            ? "CANCELLED"
            : action === "START_SEPARATION"
            ? "IN_SEPARATION"
            : r.status
        return {
          ...r,
          status: nextStatus,
          offlinePending: true,
          items:
            action === "APPROVE" && r.items
              ? r.items.map((it) => ({ ...it, approvedQuantity: it.requestedQuantity }))
              : r.items,
        }
      })
      await saveOfflineSnapshot<RequestsSnapshotData>("requests", userId, { items: currentRequests }, reqSnap.expiresAt)
    } else if (operation === "FULFILL_REQUEST" && reqSnap?.data?.items) {
      const requestId = String(payload.requestId || "")
      const deliveryItems = Array.isArray(payload.items)
        ? (payload.items as { itemId: string; locationId: string; quantity: number }[])
        : []
      const deliveryByItem = new Map(deliveryItems.map((d) => [d.itemId, d]))

      const currentRequests = reqSnap.data.items.map((r) => {
        if (r.id !== requestId) return r
        const updatedItems = (r.items ?? []).map((it) => {
          const del = deliveryByItem.get(it.id)
          if (!del) return it
          const qty = Number(del.quantity || 0)
          adjustLocalStock(it.productId, r.warehouseId || "", del.locationId, -qty)
          addLocalMovement({
            productId: it.productId,
            warehouseId: r.warehouseId || "",
            locationId: del.locationId,
            type: "EXIT",
            quantity: qty,
            referenceType: "MATERIAL_REQUEST",
            documentNumber: r.requestNumber,
          })
          return { ...it, deliveredQuantity: Number(it.deliveredQuantity) + qty }
        })
        const allDelivered =
          updatedItems.length > 0 && updatedItems.every((it) => it.deliveredQuantity >= it.approvedQuantity)
        return {
          ...r,
          status: allDelivered ? "FULFILLED" : "PARTIALLY_FULFILLED",
          fulfilledAt: nowIso,
          items: updatedItems,
          offlinePending: true,
        }
      })
      await saveOfflineSnapshot<RequestsSnapshotData>("requests", userId, { items: currentRequests }, reqSnap.expiresAt)
    } else if (operation === "CREATE_INVENTORY") {
      const warehouseId = String(payload.warehouseId || "")
      const name = String(payload.name || "Inventário Offline")
      const type = String(payload.type || "PARTIAL")
      const locationIds = Array.isArray(payload.locationIds) ? (payload.locationIds as string[]) : []
      const operatorIds = Array.isArray(payload.operatorIds) ? (payload.operatorIds as string[]) : []
      const invCode = `INV-OFF-${entityId.slice(0, 4).toUpperCase()}`

      const invLocations = locationIds.map((locId) => ({
        id: `${entityId}-${locId}`,
        locationId: locId,
        code: locationsById.get(locId)?.code || locId,
        status: "PENDING",
      }))

      const newInvRecord = {
        id: entityId,
        code: invCode,
        name,
        type,
        status: "IN_PROGRESS",
        warehouseId,
        warehouseName: warehousesById.get(warehouseId)?.name || "Almoxarifado",
        createdByName: "Você (Offline)",
        startedAt: nowIso,
        finishedAt: null,
        locations: invLocations,
        operators: operatorIds.map((opId) => {
          const op = catalog?.operators?.find((o) => o.id === opId)
          return { userId: opId, name: op?.name || "Operador", email: op?.email || null }
        }),
        collections: [],
        offlinePending: true,
      }
      ops.inventories.unshift(newInvRecord)
      opsModified = true

      if (colSnap?.data) {
        colSnap.data.inventories = [
          {
            id: entityId,
            code: invCode,
            name,
            status: "IN_PROGRESS",
            warehouseId,
            warehouseName: newInvRecord.warehouseName,
            locations: invLocations.map((l) => ({ id: l.locationId, code: l.code, status: "PENDING" })),
          },
          ...(colSnap.data.inventories ?? []),
        ]
        colModified = true
      }
    } else if (operation === "SUBMIT_COLLECTION") {
      const inventoryId = String(payload.inventoryId || "")
      const locationId = String(payload.locationId || "")
      const items = Array.isArray(payload.items) ? (payload.items as { productId: string; quantity: number }[]) : []

      if (colSnap?.data?.inventories) {
        colSnap.data.inventories = colSnap.data.inventories.map((inv) => {
          if (inv.id !== inventoryId) return inv
          return {
            ...inv,
            locations: inv.locations.filter((l) => l.id !== locationId),
          }
        })
        colModified = true
      }

      const targetInv = ops.inventories.find((inv) => inv.id === inventoryId)
      if (targetInv) {
        targetInv.locations = targetInv.locations.map((l) =>
          l.locationId === locationId ? { ...l, status: "COMPLETED" } : l
        )
        targetInv.collections = [
          {
            id: `offline-col-${entityId}`,
            locationId,
            locationCode: locationsById.get(locationId)?.code || locationId,
            operatorName: "Você (Offline)",
            itemCount: items.length,
            startedAt: nowIso,
          },
          ...(targetInv.collections ?? []),
        ]
        targetInv.offlinePending = true
        opsModified = true
      }

      await localDb.collectorDrafts.delete(`${userId}:${inventoryId}:${locationId}`).catch(() => {})
    }

    const defaultExpiry = stockSnap?.expiresAt || catalogSnap?.expiresAt || computeSnapshotExpiry()

    if (stockModified) {
      await saveOfflineSnapshot<StockSnapshotData>("stock", userId, { items: stockItems }, defaultExpiry)
    }
    if (opsModified) {
      await saveOfflineSnapshot<OperationsSnapshotData>("operations", userId, ops, opsSnap?.expiresAt || defaultExpiry)
    }
    if (colModified && colSnap) {
      await saveOfflineSnapshot<CollectorSnapshotData>("collector", userId, colSnap.data, colSnap.expiresAt || defaultExpiry)
    }
    if (reqModified && reqSnap) {
      await saveOfflineSnapshot<RequestsSnapshotData>("requests", userId, reqSnap.data, reqSnap.expiresAt || defaultExpiry)
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cgstock:offline-data-updated"))
    }
  } catch (err) {
    console.warn("Falha ao aplicar atualização otimista local:", err)
  }
}

const CORE_OFFLINE_ROUTES = [
  "/dashboard",
  "/quick-issue",
  "/collector",
  "/collector/sync",
  "/stock",
  "/products",
  "/movements",
  "/inventory",
  "/inventory/new",
  "/receipts",
  "/receipts/new",
  "/adjustments/new",
  "/transfers",
  "/transfers/new",
  "/returns",
  "/returns/new",
  "/requests",
  "/requests/new",
  "/issues",
  "/divergences",
  "/locations",
  "/categories",
  "/units",
  "/admin/employees",
  "/help",
]

/**
 * Faz o aquecimento (pre-warm) do cache de páginas HTML do App Shell para que
 * o usuário possa fechar completamente o PWA e reabri-lo sem conexão em qualquer rota.
 */
export async function warmOfflinePageCache(routes: string[] = CORE_OFFLINE_ROUTES) {
  if (typeof window === "undefined" || !("caches" in window) || !navigator.onLine) return
  try {
    const cache = await caches.open(OFFLINE_PAGE_CACHE_NAME)
    // Faz download em pequenos lotes para não sobrecarregar a rede
    const batchSize = 4
    for (let i = 0; i < routes.length; i += batchSize) {
      if (!navigator.onLine) break
      const batch = routes.slice(i, i + batchSize)
      await Promise.allSettled(
        batch.map(async (route) => {
          const response = await fetch(route, {
            credentials: "same-origin",
            headers: { "X-Offline-Warmup": "1" },
          })
          if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
            await cache.put(route, response.clone())
          }
        })
      )
    }
  } catch {
    // Falha silenciosa se a rede cair durante o aquecimento
  }
}

/**
 * Solicita armazenamento persistente ao navegador e baixa todos os módulos
 * necessários para operação 100% offline por 48h+.
 */
export async function prepareAllOfflineData(userId: string): Promise<{ moduleNames: string[]; expiresAt: Date }> {
  if (!localDb) throw new Error("Armazenamento local indisponível neste navegador.")

  if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.persist === "function") {
    void navigator.storage.persist().catch(() => {})
  }

  const response = await fetch("/api/offline/prepare", { cache: "no-store", credentials: "same-origin" })
  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error || "Não foi possível preparar os dados.")
  }
  if (body.userId !== userId || typeof body.modules !== "object" || !body.modules) {
    throw new Error("Dados recebidos para outro usuário ou incompletos.")
  }

  const expiresAt = computeSnapshotExpiry(body.expiresAt)
  const moduleNames = Object.keys(body.modules)

  for (const moduleName of moduleNames) {
    await saveOfflineSnapshot(moduleName, userId, body.modules[moduleName], expiresAt)
  }

  // Caso o endpoint /api/offline/prepare já traga collector, ótimo; se não, tenta buscar /api/offline/collector
  if (!body.modules.collector) {
    try {
      const colRes = await fetch("/api/offline/collector", { cache: "no-store", credentials: "same-origin" })
      if (colRes.ok) {
        const colData = await colRes.json()
        if (colData.userId === userId && Array.isArray(colData.products) && Array.isArray(colData.inventories)) {
          await saveOfflineSnapshot<CollectorSnapshotData>(
            "collector",
            userId,
            { products: colData.products, inventories: colData.inventories },
            expiresAt
          )
          if (!moduleNames.includes("collector")) moduleNames.push("collector")
        }
      }
    } catch {
      // Usuário pode não ter permissão específica de coletor
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cgstock:offline-data-updated"))
    void warmOfflinePageCache()
  }

  return { moduleNames, expiresAt }
}
