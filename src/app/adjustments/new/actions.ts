"use server"

import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { createStockMovement } from "@/lib/stock"
import { logAudit } from "@/lib/audit"
import { assertWarehouseAccess } from "@/lib/dal"

export async function createAdjustmentAction(data: {
  warehouseId: string
  locationId: string
  productId: string
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'
  quantity: number
  reason: string
}) {
  const session = await getValidatedSession()
  if (!session) return { success: false, error: "Não autorizado" }
  await requirePermission('STOCK_ENTRY') // Assuming adjustment requires ENTRY permission or specific ADJUST permission
  await assertWarehouseAccess(data.warehouseId, session.userId)

  if (data.quantity <= 0) {
    return { success: false, error: "Quantidade deve ser maior que zero." }
  }
  if (!data.reason || data.reason.trim().length < 5) {
    return { success: false, error: "Motivo detalhado é obrigatório (mín. 5 caracteres)." }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const move = await createStockMovement({
        productId: data.productId,
        warehouseId: data.warehouseId,
        locationId: data.locationId,
        type: data.type,
        quantity: data.quantity,
        reason: 'Ajuste Manual',
        notes: data.reason,
        performedById: session.userId
      }, tx)

      await logAudit("STOCK_ADJUSTMENT", "Stock", move.movement.id, { 
        type: data.type, 
        quantity: data.quantity, 
        reason: data.reason 
      }, session.userId, tx)

      return move
    })

    return { success: true, movementId: result.movement.id }
  } catch (error: any) {
    return { success: false, error: error.message || "Erro ao criar ajuste." }
  }
}
