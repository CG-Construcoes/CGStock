import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { executeStockTransfer } from "@/lib/stock"
import { logAudit } from "@/lib/audit"
import { assertWarehouseAccess } from "@/lib/dal"
import { checkSyncReplay, isSyncKey, isUniqueConflict, payloadHash } from "@/lib/sync-idempotency"

const MAX_ITEMS = 500
const MAX_NUMBER_ATTEMPTS = 5

type TransferItem = { productId: string; quantity: number; unitId: string; notes?: string }

export async function POST(req: NextRequest) {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  if (!session.roles?.includes('ADMIN') && !(await hasPermission('STOCK_TRANSFER'))) {
    return NextResponse.json({ error: "Sem permissão para transferências." }, { status: 403 })
  }

  try {
    const { payload, idempotencyKey, userId } = await req.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ error: "Operação pertence a outro usuário." }, { status: 403 })
    }
    if (!isSyncKey(idempotencyKey) || !payload || !Array.isArray(payload.items)) {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }

    const { sourceLocationId, destinationLocationId } = payload as Record<string, unknown>
    if (typeof sourceLocationId !== 'string' || typeof destinationLocationId !== 'string' || sourceLocationId === destinationLocationId) {
      return NextResponse.json({ error: "Localizações de origem e destino inválidas." }, { status: 400 })
    }

    const rawItems = payload.items as { productId?: unknown; quantity?: unknown; unitId?: unknown; notes?: unknown }[]
    if (!rawItems.length || rawItems.length > MAX_ITEMS) {
      return NextResponse.json({ error: "Itens da transferência inválidos." }, { status: 400 })
    }
    const items: TransferItem[] = rawItems.map(i => ({
      productId: typeof i?.productId === 'string' ? i.productId : '',
      quantity: Number(i?.quantity),
      unitId: typeof i?.unitId === 'string' ? i.unitId : '',
      notes: typeof i?.notes === 'string' ? i.notes.slice(0, 500) : undefined
    }))
    if (items.some(i => !i.productId || !i.unitId || !Number.isSafeInteger(i.quantity) || i.quantity <= 0)) {
      return NextResponse.json({ error: "Itens da transferência inválidos." }, { status: 400 })
    }

    const [sourceLoc, destLoc] = await Promise.all([
      db.warehouseLocation.findUnique({ where: { id: sourceLocationId } }),
      db.warehouseLocation.findUnique({ where: { id: destinationLocationId } })
    ])
    if (!sourceLoc || !destLoc) {
      return NextResponse.json({ error: "Localizações não encontradas." }, { status: 404 })
    }
    try {
      await assertWarehouseAccess(sourceLoc.warehouseId, session.userId)
      await assertWarehouseAccess(destLoc.warehouseId, session.userId)
    } catch {
      return NextResponse.json({ error: "Sem acesso a um dos almoxarifados." }, { status: 403 })
    }

    const products = await db.product.findMany({
      where: { id: { in: items.map(i => i.productId) }, status: 'ACTIVE' },
      select: { id: true, unitId: true }
    })
    const productUnits = new Map(products.map(p => [p.id, p.unitId]))
    if (products.length !== new Set(items.map(i => i.productId)).size ||
        items.some(i => productUnits.get(i.productId) !== i.unitId)) {
      return NextResponse.json({ error: "Produto ou unidade inválida." }, { status: 400 })
    }

    const hash = payloadHash(payload)
    const replay = await checkSyncReplay(session.userId, 'CREATE_TRANSFER', idempotencyKey, hash)
    if (replay === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
    if (replay === 'conflict') return NextResponse.json({ error: "Esta operação foi alterada. Revise antes de sincronizar." }, { status: 409 })

    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
      const count = await db.stockTransfer.count()
      const transferNumber = `TRF-${new Date().getFullYear()}-${String(count + 1 + attempt).padStart(4, '0')}`
      try {
        const transferId = await db.$transaction(async tx => {
          const operation = await tx.offlineSyncOperation.create({
            data: { userId: session.userId, operation: 'CREATE_TRANSFER', idempotencyKey, entityKey: idempotencyKey, payloadHash: hash }
          })
          const transfer = await tx.stockTransfer.create({
            data: {
              transferNumber,
              sourceWarehouseId: sourceLoc.warehouseId,
              sourceLocationId,
              destinationWarehouseId: destLoc.warehouseId,
              destinationLocationId,
              createdById: session.userId,
              status: 'DRAFT'
            }
          })
          await executeStockTransfer(transfer.id, session.userId, items, tx)
          await tx.offlineSyncOperation.update({ where: { id: operation.id }, data: { resultId: transfer.id } })
          await logAudit("TRANSFER_CREATED_OFFLINE", "StockTransfer", transfer.id, { transferNumber }, session.userId, tx)
          return transfer.id
        })
        return NextResponse.json({ success: true, transferId, transferNumber })
      } catch (error) {
        if (isUniqueConflict(error)) {
          const target = JSON.stringify((error as { meta?: { target?: unknown } }).meta?.target ?? '')
          if (target.includes('transferNumber')) continue
          const result = await checkSyncReplay(session.userId, 'CREATE_TRANSFER', idempotencyKey, hash)
          if (result === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
          return NextResponse.json({ error: "Transferência duplicada ou alterada. Revise antes de sincronizar." }, { status: 409 })
        }
        if (error instanceof Error && /já foi executada|estoque insuficiente|saldo/i.test(error.message)) {
          return NextResponse.json({ error: `${error.message}. Revise manualmente.` }, { status: 409 })
        }
        throw error
      }
    }
    return NextResponse.json({ error: "Não foi possível gerar o número da transferência. Tente novamente." }, { status: 409 })
  } catch (err) {
    console.error("Offline sync error (transfer):", err)
    return NextResponse.json({ error: "Erro interno ao processar a transferência." }, { status: 500 })
  }
}
