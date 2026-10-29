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

  if (!session.roles?.includes("ADMIN") && !(await hasPermission("STOCK_ENTRY"))) {
    return NextResponse.json({ error: "Sem permissão para confirmar recebimentos." }, { status: 403 })
  }

  try {
    const { payload, idempotencyKey, userId } = await req.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ error: "Operação pertence a outro usuário." }, { status: 403 })
    }
    if (!isSyncKey(idempotencyKey) || !payload || typeof payload.receiptId !== "string") {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }

    const receiptId = payload.receiptId
    const hash = payloadHash(payload)
    const replay = await checkSyncReplay(session.userId, "CONFIRM_RECEIPT", idempotencyKey, hash)
    if (replay === "replayed") return NextResponse.json({ success: true, alreadyProcessed: true })
    if (replay === "conflict") return NextResponse.json({ error: "Esta operação foi alterada. Revise antes de sincronizar." }, { status: 409 })

    const receipt = await db.stockReceipt.findUnique({
      where: { id: receiptId },
      include: { items: true }
    })
    if (!receipt) return NextResponse.json({ error: "Recebimento não encontrado. Revise manualmente." }, { status: 409 })

    try {
      await assertWarehouseAccess(receipt.warehouseId, session.userId)
    } catch {
      return NextResponse.json({ error: "Sem acesso a este almoxarifado." }, { status: 403 })
    }

    if (receipt.status === "COMPLETED") {
      return NextResponse.json({ success: true, alreadyProcessed: true, receiptId })
    }
    if (receipt.status !== "DRAFT") {
      return NextResponse.json({ error: "Apenas recebimentos em rascunho podem ser confirmados." }, { status: 409 })
    }

    try {
      await db.$transaction(async (tx) => {
        const operation = await tx.offlineSyncOperation.create({
          data: {
            userId: session.userId,
            operation: "CONFIRM_RECEIPT",
            idempotencyKey,
            entityKey: `confirm_${receiptId}`,
            payloadHash: hash,
            resultId: receiptId,
          }
        })
        await tx.stockReceipt.update({
          where: { id: receipt.id },
          data: { status: "COMPLETED", receivedAt: new Date() }
        })
        for (const item of receipt.items) {
          await createStockMovement({
            productId: item.productId,
            warehouseId: receipt.warehouseId,
            locationId: item.locationId,
            type: "ENTRY",
            quantity: Number(item.quantity),
            unitCost: item.unitCost ? Number(item.unitCost) : null,
            totalCost: item.totalCost ? Number(item.totalCost) : null,
            referenceType: "RECEIPT",
            referenceId: receipt.id,
            documentNumber: receipt.documentNumber,
            performedById: session.userId,
          }, tx)
        }
        await tx.offlineSyncOperation.update({ where: { id: operation.id }, data: { resultId: receipt.id } })
        await logAudit("RECEIPT_CONFIRMED_OFFLINE", "StockReceipt", receipt.id, { status: "COMPLETED" }, session.userId, tx)
      })
      return NextResponse.json({ success: true, receiptId })
    } catch (error) {
      if (isUniqueConflict(error)) {
        const result = await checkSyncReplay(session.userId, "CONFIRM_RECEIPT", idempotencyKey, hash)
        if (result === "replayed") return NextResponse.json({ success: true, alreadyProcessed: true })
        return NextResponse.json({ error: "Recebimento já confirmado por outro operador. Revise manualmente." }, { status: 409 })
      }
      throw error
    }
  } catch (err) {
    console.error("Offline sync error (receipt-confirm):", err)
    return NextResponse.json({ error: "Erro interno ao confirmar o recebimento." }, { status: 500 })
  }
}
