import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { assertWarehouseAccess } from "@/lib/dal"
import { checkSyncReplay, isSyncKey, isUniqueConflict, payloadHash } from "@/lib/sync-idempotency"

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
const ACTIONS = ['DRAFT', 'PENDING_APPROVAL']
const MAX_ITEMS = 500
const MAX_NUMBER_ATTEMPTS = 5

type RequestItem = { productId: string; unitId: string; requestedQuantity: number }

export async function POST(req: NextRequest) {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  if (!session.roles?.includes('ADMIN') && !(await hasPermission('REQUEST_CREATE'))) {
    return NextResponse.json({ error: "Sem permissão para criar requisições." }, { status: 403 })
  }

  try {
    const { payload, idempotencyKey, userId } = await req.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ error: "Operação pertence a outro usuário." }, { status: 403 })
    }
    if (!isSyncKey(idempotencyKey) || !payload || typeof payload.warehouseId !== 'string' || !Array.isArray(payload.items)) {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }

    const warehouseId = payload.warehouseId
    try {
      await assertWarehouseAccess(warehouseId, session.userId)
    } catch {
      return NextResponse.json({ error: "Sem acesso a este almoxarifado." }, { status: 403 })
    }

    const actionType = payload.actionType === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'DRAFT'
    const priority = PRIORITIES.includes(payload.priority) ? payload.priority : 'NORMAL'
    const notes = typeof payload.notes === 'string' ? payload.notes.slice(0, 1000) : null
    const rawItems = payload.items as { productId?: unknown; unitId?: unknown; requestedQuantity?: unknown }[]
    if (!rawItems.length || rawItems.length > MAX_ITEMS || !ACTIONS.includes(actionType)) {
      return NextResponse.json({ error: "Itens da requisição inválidos." }, { status: 400 })
    }

    const items: RequestItem[] = rawItems.map(i => ({
      productId: typeof i?.productId === 'string' ? i.productId : '',
      unitId: typeof i?.unitId === 'string' ? i.unitId : '',
      requestedQuantity: Number(i?.requestedQuantity)
    }))
    if (items.some(i => !i.productId || !i.unitId || !Number.isSafeInteger(i.requestedQuantity) || i.requestedQuantity <= 0)) {
      return NextResponse.json({ error: "Itens da requisição inválidos." }, { status: 400 })
    }

    const hash = payloadHash(payload)
    const replay = await checkSyncReplay(session.userId, 'CREATE_REQUEST', idempotencyKey, hash)
    if (replay === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
    if (replay === 'conflict') return NextResponse.json({ error: "Esta operação foi alterada. Revise antes de sincronizar." }, { status: 409 })

    const products = await db.product.findMany({
      where: { id: { in: items.map(i => i.productId) }, status: 'ACTIVE' },
      select: { id: true, unitId: true }
    })
    const productUnits = new Map(products.map(p => [p.id, p.unitId]))
    if (products.length !== new Set(items.map(i => i.productId)).size ||
        items.some(i => productUnits.get(i.productId) !== i.unitId)) {
      return NextResponse.json({ error: "Produto ou unidade inválida." }, { status: 400 })
    }

    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
      const count = await db.materialRequest.count()
      const requestNumber = `REQ-${String(count + 1 + attempt).padStart(4, '0')}`
      try {
        const requestId = await db.$transaction(async tx => {
          const operation = await tx.offlineSyncOperation.create({
            data: { userId: session.userId, operation: 'CREATE_REQUEST', idempotencyKey, entityKey: idempotencyKey, payloadHash: hash }
          })
          const request = await tx.materialRequest.create({
            data: {
              requestNumber,
              requesterId: session.userId,
              warehouseId,
              priority,
              notes,
              status: actionType,
              requestedAt: actionType === 'PENDING_APPROVAL' ? new Date() : null,
              items: { create: items }
            }
          })
          await tx.offlineSyncOperation.update({ where: { id: operation.id }, data: { resultId: request.id } })
          await logAudit("REQUEST_CREATED_OFFLINE", "MaterialRequest", request.id, { status: actionType, requestNumber }, session.userId, tx)
          return request.id
        })
        return NextResponse.json({ success: true, requestId, requestNumber })
      } catch (error) {
        if (isUniqueConflict(error)) {
          const target = JSON.stringify((error as { meta?: { target?: unknown } }).meta?.target ?? '')
          if (target.includes('requestNumber')) continue
          const result = await checkSyncReplay(session.userId, 'CREATE_REQUEST', idempotencyKey, hash)
          if (result === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
          return NextResponse.json({ error: "Requisição duplicada ou alterada. Revise antes de sincronizar." }, { status: 409 })
        }
        throw error
      }
    }
    return NextResponse.json({ error: "Não foi possível gerar o número da requisição. Tente novamente." }, { status: 409 })
  } catch (err) {
    console.error("Offline sync error (request):", err)
    return NextResponse.json({ error: "Erro interno ao processar a requisição." }, { status: 500 })
  }
}
