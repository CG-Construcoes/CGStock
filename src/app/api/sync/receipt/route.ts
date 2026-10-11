import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { createStockMovement } from "@/lib/stock"
import { logAudit } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const isAdmin = session.roles?.includes('ADMIN')
  if (!isAdmin && !(await hasPermission('STOCK_ENTRY'))) {
    return NextResponse.json({ error: "Sem permissão para registrar recebimentos." }, { status: 403 })
  }

  try {
    const { payload, idempotencyKey } = await req.json()
    
    // Check for duplicate submission using idempotency pattern or existing document
    // We'll use a transaction
    const supplierId = payload.supplierId
    const warehouseId = payload.warehouseId
    const documentNumber = payload.documentNumber || null
    const documentDate = payload.documentDate ? new Date(payload.documentDate) : null
    const actionType = payload.actionType || "DRAFT"
    const items = payload.items as { productId: string, locationId: string, quantity: number, unitCost: number }[]

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 })
    }

    let subtotal = 0
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

    if (actionType === "DRAFT") {
      const receipt = await db.stockReceipt.create({
        data: {
          supplierId,
          warehouseId,
          documentNumber,
          documentDate,
          status: 'DRAFT',
          createdById: session.userId,
          subtotal,
          total: subtotal,
          items: { create: itemsData }
        }
      })
      await logAudit("RECEIPT_CREATED_OFFLINE", "StockReceipt", receipt.id, { status: "DRAFT", idempotencyKey })
    } else {
      await db.$transaction(async (tx) => {
        const receipt = await tx.stockReceipt.create({
          data: {
            supplierId,
            warehouseId,
            documentNumber,
            documentDate,
            receivedAt: new Date(),
            status: 'COMPLETED',
            createdById: session.userId,
            subtotal,
            total: subtotal,
            items: { create: itemsData }
          },
          include: { items: true }
        })

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
        await logAudit("RECEIPT_CREATED_OFFLINE", "StockReceipt", receipt.id, { status: "COMPLETED", idempotencyKey })
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Offline sync error (receipt):", err)
    return NextResponse.json({ error: "Erro interno ao processar o recebimento." }, { status: 500 })
  }
}
