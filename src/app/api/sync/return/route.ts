import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { receiveMaterialReturn } from "@/lib/stock"
import { logAudit } from "@/lib/audit"
import { assertWarehouseAccess } from "@/lib/dal"
import { checkSyncReplay, isSyncKey, isUniqueConflict, payloadHash } from "@/lib/sync-idempotency"

const CONDITIONS = ['GOOD', 'DAMAGED', 'UNUSABLE']
const MAX_ITEMS = 500
const MAX_NUMBER_ATTEMPTS = 5

type ReturnItem = { productId: string; locationId: string; quantity: number; unitId: string; condition: 'GOOD' | 'DAMAGED' | 'UNUSABLE'; notes?: string }

export async function POST(req: NextRequest) {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  if (!session.roles?.includes('ADMIN') && !(await hasPermission('STOCK_ENTRY'))) {
    return NextResponse.json({ error: "Sem permissão para registrar devoluções." }, { status: 403 })
  }

  try {
    const { payload, idempotencyKey, userId } = await req.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ error: "Operação pertence a outro usuário." }, { status: 403 })
    }
    if (!isSyncKey(idempotencyKey) || !payload || typeof payload.warehouseId !== 'string') {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }

    const warehouseId = payload.warehouseId as string
    const requestId = typeof payload.requestId === 'string' && payload.requestId ? payload.requestId : null
    const reason = typeof payload.reason === 'string' ? payload.reason.slice(0, 1000) : null

    try {
      await assertWarehouseAccess(warehouseId, session.userId)
    } catch {
      return NextResponse.json({ error: "Sem acesso a este almoxarifado." }, { status: 403 })
    }
    if (requestId) {
      const request = await db.materialRequest.findFirst({ where: { id: requestId, warehouseId } })
      if (!request) return NextResponse.json({ error: "Requisição não pertence ao almoxarifado selecionado." }, { status: 400 })
    }

    const rawItems = Array.isArray(payload.items) ? payload.items as { productId?: unknown; locationId?: unknown; quantity?: unknown; unitId?: unknown; condition?: unknown; notes?: unknown }[] : []
    const items: ReturnItem[] = rawItems.map(i => ({
      productId: typeof i?.productId === 'string' ? i.productId : '',
      locationId: typeof i?.locationId === 'string' ? i.locationId : '',
      quantity: Number(i?.quantity),
      unitId: typeof i?.unitId === 'string' ? i.unitId : '',
      condition: CONDITIONS.includes(i?.condition as string) ? i.condition as ReturnItem['condition'] : 'GOOD',
      notes: typeof i?.notes === 'string' ? i.notes.slice(0, 500) : undefined
    }))
    if (items.length > MAX_ITEMS || items.some(i => !i.productId || !i.locationId || !i.unitId || !Number.isSafeInteger(i.quantity) || i.quantity <= 0)) {
      return NextResponse.json({ error: "Itens da devolução inválidos." }, { status: 400 })
    }
    if (items.length) {
      const products = await db.product.findMany({
        where: { id: { in: items.map(i => i.productId) } },
        select: { id: true, unitId: true }
      })
      const productUnits = new Map(products.map(p => [p.id, p.unitId]))
      if (items.some(i => productUnits.get(i.productId) !== i.unitId)) {
        return NextResponse.json({ error: "Produto ou unidade inválida." }, { status: 400 })
      }
      const locations = await db.warehouseLocation.count({ where: { id: { in: items.map(i => i.locationId) }, warehouseId } })
      if (locations !== new Set(items.map(i => i.locationId)).size) {
        return NextResponse.json({ error: "Localização inválida." }, { status: 400 })
      }
    }

    const hash = payloadHash(payload)
    const replay = await checkSyncReplay(session.userId, 'CREATE_RETURN', idempotencyKey, hash)
    if (replay === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
    if (replay === 'conflict') return NextResponse.json({ error: "Esta operação foi alterada. Revise antes de sincronizar." }, { status: 409 })

    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
      const count = await db.materialReturn.count()
      const returnNumber = `RET-${new Date().getFullYear()}-${String(count + 1 + attempt).padStart(4, '0')}`
      try {
        const returnId = await db.$transaction(async tx => {
          const operation = await tx.offlineSyncOperation.create({
            data: { userId: session.userId, operation: 'CREATE_RETURN', idempotencyKey, entityKey: idempotencyKey, payloadHash: hash }
          })
          const ret = await tx.materialReturn.create({
            data: { returnNumber, warehouseId, returnedById: session.userId, requestId, reason, status: 'DRAFT' }
          })
          if (items.length) {
            await receiveMaterialReturn(ret.id, session.userId, items, tx)
          }
          await tx.offlineSyncOperation.update({ where: { id: operation.id }, data: { resultId: ret.id } })
          await logAudit("RETURN_CREATED_OFFLINE", "MaterialReturn", ret.id, { returnNumber }, session.userId, tx)
          return ret.id
        })
        return NextResponse.json({ success: true, returnId, returnNumber })
      } catch (error) {
        if (isUniqueConflict(error)) {
          const target = JSON.stringify((error as { meta?: { target?: unknown } }).meta?.target ?? '')
          if (target.includes('returnNumber')) continue
          const result = await checkSyncReplay(session.userId, 'CREATE_RETURN', idempotencyKey, hash)
          if (result === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
          return NextResponse.json({ error: "Devolução duplicada ou alterada. Revise antes de sincronizar." }, { status: 409 })
        }
        throw error
      }
    }
    return NextResponse.json({ error: "Não foi possível gerar o número da devolução. Tente novamente." }, { status: 409 })
  } catch (err) {
    console.error("Offline sync error (return):", err)
    return NextResponse.json({ error: "Erro interno ao processar a devolução." }, { status: 500 })
  }
}
