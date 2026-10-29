import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { createStockMovement } from "@/lib/stock"
import { logAudit } from "@/lib/audit"
import { assertWarehouseAccess } from "@/lib/dal"
import { checkSyncReplay, isSyncKey, isUniqueConflict, payloadHash } from "@/lib/sync-idempotency"

const TYPES = ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']

export async function POST(req: NextRequest) {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  // Mantém paridade com createAdjustmentAction, que exige STOCK_ENTRY
  if (!session.roles?.includes('ADMIN') && !(await hasPermission('STOCK_ENTRY'))) {
    return NextResponse.json({ error: "Sem permissão para registrar ajustes." }, { status: 403 })
  }

  try {
    const { payload, idempotencyKey, userId } = await req.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ error: "Operação pertence a outro usuário." }, { status: 403 })
    }
    if (!isSyncKey(idempotencyKey) || !payload) {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }

    const { warehouseId, locationId, productId, type, quantity, reason } = payload as Record<string, unknown>
    if (typeof warehouseId !== 'string' || typeof locationId !== 'string' || typeof productId !== 'string' ||
        typeof type !== 'string' || !TYPES.includes(type) ||
        !Number.isSafeInteger(Number(quantity)) || Number(quantity) <= 0 ||
        typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json({ error: "Dados do ajuste inválidos." }, { status: 400 })
    }

    try {
      await assertWarehouseAccess(warehouseId, session.userId)
    } catch {
      return NextResponse.json({ error: "Sem acesso a este almoxarifado." }, { status: 403 })
    }

    const hash = payloadHash(payload)
    const replay = await checkSyncReplay(session.userId, 'CREATE_ADJUSTMENT', idempotencyKey, hash)
    if (replay === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
    if (replay === 'conflict') return NextResponse.json({ error: "Esta operação foi alterada. Revise antes de sincronizar." }, { status: 409 })

    try {
      const movementId = await db.$transaction(async tx => {
        const operation = await tx.offlineSyncOperation.create({
          data: { userId: session.userId, operation: 'CREATE_ADJUSTMENT', idempotencyKey, entityKey: idempotencyKey, payloadHash: hash }
        })
        const move = await createStockMovement({
          productId, warehouseId, locationId,
          type: type as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
          quantity: Number(quantity),
          reason: 'Ajuste Manual',
          notes: reason.trim().slice(0, 1000),
          performedById: session.userId
        }, tx)
        await tx.offlineSyncOperation.update({ where: { id: operation.id }, data: { resultId: move.movement.id } })
        await logAudit("STOCK_ADJUSTMENT_OFFLINE", "Stock", move.movement.id, { type, quantity: Number(quantity), reason }, session.userId, tx)
        return move.movement.id
      })
      return NextResponse.json({ success: true, movementId })
    } catch (error) {
      if (isUniqueConflict(error)) {
        const result = await checkSyncReplay(session.userId, 'CREATE_ADJUSTMENT', idempotencyKey, hash)
        if (result === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
        return NextResponse.json({ error: "Ajuste duplicado ou alterado. Revise antes de sincronizar." }, { status: 409 })
      }
      if (error instanceof Error && /estoque insuficiente|saldo|não encontrad/i.test(error.message)) {
        return NextResponse.json({ error: `${error.message}. Revise manualmente.` }, { status: 409 })
      }
      throw error
    }
  } catch (err) {
    console.error("Offline sync error (adjustment):", err)
    return NextResponse.json({ error: "Erro interno ao processar o ajuste." }, { status: 500 })
  }
}
