import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { createStockMovement } from "@/lib/stock"
import { logAudit } from "@/lib/audit"
import { assertWarehouseAccess } from "@/lib/dal"
import { checkSyncReplay, isSyncKey, isUniqueConflict, payloadHash } from "@/lib/sync-idempotency"

export async function POST(req: NextRequest) {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const isAdmin = session.roles?.includes('ADMIN')
  if (!isAdmin && !(await hasPermission('STOCK_ENTRY'))) {
    return NextResponse.json({ error: "Sem permissão para registrar recebimentos." }, { status: 403 })
  }

  try {
    const { payload, idempotencyKey, userId } = await req.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ error: "Operação pertence a outro usuário." }, { status: 403 })
    }

    // Check for duplicate submission using idempotency pattern or existing document
    // We'll use a transaction
    if (!payload || typeof payload.warehouseId !== 'string') {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }
    const supplierId = payload.supplierId
    const warehouseId = payload.warehouseId
    try {
      await assertWarehouseAccess(warehouseId, session.userId)
    } catch {
      return NextResponse.json({ error: "Sem acesso a este almoxarifado." }, { status: 403 })
    }
    if (!isSyncKey(idempotencyKey) || !Array.isArray(payload.items)) {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }
    const hash = payloadHash(payload)
    const replay = await checkSyncReplay(session.userId, 'CREATE_RECEIPT', idempotencyKey, hash)
    if (replay === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
    if (replay === 'conflict') return NextResponse.json({ error: "Esta operação foi alterada. Revise antes de sincronizar." }, { status: 409 })
    const documentNumber = payload.documentNumber || null
    const documentDate = payload.documentDate ? new Date(payload.documentDate) : null
    const actionType = payload.actionType || "DRAFT"
    const items = payload.items as { productId: string, locationId: string, quantity: number, unitCost: number }[]

    if (!items.length || items.length > 5000 || !['DRAFT', 'COMPLETED'].includes(actionType) ||
      items.some(item => !item || !item.productId || !item.locationId || !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0)) {
      return NextResponse.json({ error: "Itens de recebimento inválidos." }, { status: 400 })
    }

    let subtotal = 0
    const locations = await db.warehouseLocation.count({ where: { id: { in: items.map(item => item.locationId) }, warehouseId } })
    if (locations !== new Set(items.map(item => item.locationId)).size) return NextResponse.json({ error: "Localização inválida." }, { status: 400 })
    const itemsData = items.map(item => {
      const quantity = Number(item.quantity) || 0
      const unitCost = Number(item.unitCost) || 0
      const totalCost = quantity * unitCost
      subtotal += totalCost
      return {
        productId: item.productId,
        locationId: item.locationId,
        quantity,
        unitCost,
        totalCost
      }
    })

    try {
      const receiptId = await db.$transaction(async tx => {
        const operation = await tx.offlineSyncOperation.create({
          data: { userId: session.userId, operation: 'CREATE_RECEIPT', idempotencyKey, entityKey: idempotencyKey, payloadHash: hash }
        })
        const receipt = await tx.stockReceipt.create({
          data: {
            supplierId,
            warehouseId,
            documentNumber,
            documentDate,
            receivedAt: actionType === 'COMPLETED' ? new Date() : null,
            status: actionType,
            createdById: session.userId,
            subtotal,
            total: subtotal,
            items: { create: itemsData }
          },
          include: { items: true }
        })

        if (actionType === 'COMPLETED') {
          for (const item of receipt.items) {
            await createStockMovement({
              productId: item.productId,
              warehouseId: receipt.warehouseId,
              locationId: item.locationId,
              type: 'ENTRY',
              quantity: Number(item.quantity),
              unitCost: Number(item.unitCost),
              totalCost: Number(item.totalCost),
              referenceType: 'RECEIPT',
              referenceId: receipt.id,
              documentNumber: receipt.documentNumber,
              performedById: session.userId
            }, tx)
          }
        }
        await tx.offlineSyncOperation.update({ where: { id: operation.id }, data: { resultId: receipt.id } })
        await logAudit("RECEIPT_CREATED_OFFLINE", "StockReceipt", receipt.id, { status: actionType, idempotencyKey }, session.userId, tx)
        return receipt.id
      })
      return NextResponse.json({ success: true, receiptId })
    } catch (error) {
      if (isUniqueConflict(error)) {
        const result = await checkSyncReplay(session.userId, 'CREATE_RECEIPT', idempotencyKey, hash)
        if (result === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
        return NextResponse.json({ error: "Recebimento duplicado ou alterado. Revise antes de sincronizar." }, { status: 409 })
      }
      throw error
    }
  } catch (err) {
    console.error("Offline sync error (receipt):", err)
    return NextResponse.json({ error: "Erro interno ao processar o recebimento." }, { status: 500 })
  }
}
