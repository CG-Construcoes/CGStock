import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { assertWarehouseAccess } from "@/lib/dal"
import { deliverMaterialRequest } from "@/lib/stock"
import { checkSyncReplay, isSyncKey, isUniqueConflict, payloadHash } from "@/lib/sync-idempotency"

const MAX_ITEMS = 500

/**
 * Sincroniza um atendimento de requisição registrado offline.
 * Divergências (requisição já atendida, quantidade maior que a pendente)
 * retornam 409 para revisão manual.
 */
export async function POST(req: NextRequest) {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  if (!session.roles?.includes('ADMIN') && !(await hasPermission('REQUEST_FULFILL'))) {
    return NextResponse.json({ error: "Sem permissão para atender requisições." }, { status: 403 })
  }

  try {
    const { payload, idempotencyKey, userId } = await req.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ error: "Operação pertence a outro usuário." }, { status: 403 })
    }
    if (!isSyncKey(idempotencyKey) || !payload || typeof payload.requestId !== 'string' || !Array.isArray(payload.items)) {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }

    const requestId = payload.requestId
    const rawItems = payload.items as { itemId?: unknown; locationId?: unknown; quantity?: unknown }[]
    const items = rawItems.map(i => ({
      itemId: typeof i?.itemId === 'string' ? i.itemId : '',
      locationId: typeof i?.locationId === 'string' ? i.locationId : '',
      quantity: Number(i?.quantity)
    })).filter(i => i.quantity > 0)
    if (!items.length || items.length > MAX_ITEMS || items.some(i => !i.itemId || !i.locationId || !Number.isFinite(i.quantity))) {
      return NextResponse.json({ error: "Itens de entrega inválidos." }, { status: 400 })
    }

    const request = await db.materialRequest.findUnique({
      where: { id: requestId },
      include: { items: true }
    })
    if (!request) return NextResponse.json({ error: "Requisição não encontrada. Revise manualmente." }, { status: 409 })
    if (request.status === 'FULFILLED' || request.status === 'CANCELLED' || request.status === 'REJECTED') {
      return NextResponse.json({ error: "A requisição não está mais apta a atendimento. Revise manualmente." }, { status: 409 })
    }
    try {
      await assertWarehouseAccess(request.warehouseId, session.userId)
    } catch {
      return NextResponse.json({ error: "Sem acesso a este almoxarifado." }, { status: 403 })
    }

    const requestItemIds = new Set(request.items.map(i => i.id))
    const pendingByItem = new Map(request.items.map(i => [i.id, Number(i.approvedQuantity) - Number(i.deliveredQuantity)]))
    if (items.some(i => !requestItemIds.has(i.itemId) || i.quantity > (pendingByItem.get(i.itemId) ?? 0))) {
      return NextResponse.json({ error: "Quantidade diverge do pendente aprovado. Revise manualmente." }, { status: 409 })
    }

    const locations = await db.warehouseLocation.count({
      where: { id: { in: items.map(i => i.locationId) }, warehouseId: request.warehouseId }
    })
    if (locations !== new Set(items.map(i => i.locationId)).size) {
      return NextResponse.json({ error: "Localização inválida para este almoxarifado." }, { status: 400 })
    }

    const hash = payloadHash(payload)
    const replay = await checkSyncReplay(session.userId, 'FULFILL_REQUEST', idempotencyKey, hash)
    if (replay === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
    if (replay === 'conflict') return NextResponse.json({ error: "Esta operação foi alterada. Revise antes de sincronizar." }, { status: 409 })

    try {
      await db.$transaction(async tx => {
        const operation = await tx.offlineSyncOperation.create({
          data: { userId: session.userId, operation: 'FULFILL_REQUEST', idempotencyKey, entityKey: idempotencyKey, payloadHash: hash }
        })
        await deliverMaterialRequest(requestId, session.userId, items, tx)
        await tx.offlineSyncOperation.update({ where: { id: operation.id }, data: { resultId: requestId } })
        await logAudit("REQUEST_FULFILLED_OFFLINE", "MaterialRequest", requestId, { itemCount: items.length }, session.userId, tx)
      })
      return NextResponse.json({ success: true, requestId })
    } catch (error) {
      if (isUniqueConflict(error)) {
        const result = await checkSyncReplay(session.userId, 'FULFILL_REQUEST', idempotencyKey, hash)
        if (result === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
        return NextResponse.json({ error: "Atendimento duplicado ou alterado. Revise antes de sincronizar." }, { status: 409 })
      }
      if (error instanceof Error && /quantidade|atendida|estoque|saldo/i.test(error.message)) {
        return NextResponse.json({ error: `${error.message} Revise manualmente.` }, { status: 409 })
      }
      throw error
    }
  } catch (err) {
    console.error("Offline sync error (fulfill):", err)
    return NextResponse.json({ error: "Erro interno ao processar o atendimento." }, { status: 500 })
  }
}
