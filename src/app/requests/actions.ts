"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { deliverMaterialRequest } from "@/lib/stock"
import { logAudit } from "@/lib/audit"
import { requireSession, requireActionPermission } from "@/lib/action-guard"
import { hasPermission } from "@/lib/permissions"
import { createWithUniqueNumber } from "@/lib/sequential"
import { assertWarehouseAccess, warehouseIdFilter } from "@/lib/dal"

export async function createRequestAction(formData: FormData) {
  const session = await requireActionPermission('REQUEST_CREATE')

  const warehouseId = formData.get("warehouseId") as string
  await assertWarehouseAccess(warehouseId, session.userId)
  const priority = formData.get("priority") as string
  const notes = formData.get("notes") as string
  const actionType = formData.get("actionType") as string

  const itemKeys = Array.from(formData.keys()).filter(k => k.startsWith('item_productId_'))
  const items = itemKeys.map(key => {
    const uniqueSuffix = key.replace('item_productId_', '')
    return {
      productId: formData.get(`item_productId_${uniqueSuffix}`) as string,
      requestedQuantity: Number(formData.get(`item_quantity_${uniqueSuffix}`)),
      unitId: formData.get(`item_unitId_${uniqueSuffix}`) as string,
    }
  }).filter(i => i.productId && i.requestedQuantity > 0 && i.unitId)

  if (items.length === 0) throw new Error("A requisição deve ter pelo menos um item.")

  const request = await createWithUniqueNumber(
    async (attempt) => {
      const count = await db.materialRequest.count()
      return `REQ-${String(count + 1 + attempt).padStart(4, '0')}`
    },
    (requestNumber) => db.materialRequest.create({
      data: {
        requestNumber,
        requesterId: session.userId,
        warehouseId,
        priority,
        notes,
        status: actionType === 'DRAFT' ? 'DRAFT' : 'PENDING_APPROVAL',
        requestedAt: actionType === 'DRAFT' ? null : new Date(),
        items: { create: items }
      }
    })
  )

  await logAudit("REQUEST_CREATED", "MaterialRequest", request.id, { 
    status: actionType === 'DRAFT' ? 'DRAFT' : 'PENDING_APPROVAL',
    requestNumber: request.requestNumber 
  })

  revalidatePath("/requests")
  redirect(`/requests/${request.id}`)
}

export async function approveRequestAction(requestId: string) {
  const session = await requireActionPermission('REQUEST_APPROVE')

  const req = await db.materialRequest.findFirst({ where: { id: requestId, ...await warehouseIdFilter() } })
  if (!req) throw new Error("Requisição não encontrada")
  if (req.status !== 'PENDING_APPROVAL') throw new Error("A requisição não está aguardando aprovação.")

  await db.$transaction(async (tx) => {
    await tx.materialRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedById: session.userId,
        approvedAt: new Date(),
      }
    })
    // Aprova a quantidade total solicitada de todos os itens em uma única query
    await tx.$executeRaw`
      UPDATE "MaterialRequestItem"
      SET "approvedQuantity" = "requestedQuantity", "updatedAt" = NOW()
      WHERE "requestId" = ${requestId}
    `
  })

  await logAudit("REQUEST_APPROVED", "MaterialRequest", requestId)

  revalidatePath(`/requests/${requestId}`)
  revalidatePath("/requests")
}

export async function rejectRequestAction(requestId: string, reason: string) {
  await requireActionPermission('REQUEST_APPROVE')

  const req = await db.materialRequest.findFirst({ where: { id: requestId, ...await warehouseIdFilter() } })
  if (!req) throw new Error("Requisição não encontrada")
  if (req.status !== 'PENDING_APPROVAL') throw new Error("A requisição não está aguardando aprovação.")

  await db.materialRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      notes: reason,
    }
  })

  await logAudit("REQUEST_REJECTED", "MaterialRequest", requestId, { reason })

  revalidatePath(`/requests/${requestId}`)
  revalidatePath("/requests")
}

export async function cancelRequestAction(requestId: string) {
  const session = await requireSession()

  const req = await db.materialRequest.findFirst({ where: { id: requestId, ...await warehouseIdFilter() } })
  if (!req) throw new Error("Requisição não encontrada")

  const isRequester = req.requesterId === session.userId
  const isApprover = await hasPermission('REQUEST_APPROVE')
  if (!isRequester && !isApprover) {
    throw new Error("Apenas o solicitante ou um aprovador pode cancelar esta requisição.")
  }

  if (['PARTIALLY_FULFILLED', 'FULFILLED'].includes(req.status)) {
    throw new Error("Não é possível cancelar uma requisição que já teve itens separados/entregues. Faça um estorno das movimentações de saída no módulo de devoluções.")
  }

  await db.materialRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED' }
  })

  await logAudit("REQUEST_CANCELLED", "MaterialRequest", requestId)

  revalidatePath(`/requests/${requestId}`)
  revalidatePath("/requests")
}

export async function startSeparationAction(requestId: string) {
  await requireActionPermission('REQUEST_FULFILL')

  const req = await db.materialRequest.findFirst({ where: { id: requestId, ...await warehouseIdFilter() } })
  if (!req) throw new Error("Requisição não encontrada")

  if (req.status !== 'APPROVED') {
    throw new Error("A requisição precisa estar aprovada para iniciar a separação.")
  }

  await db.materialRequest.update({
    where: { id: requestId },
    data: { status: 'IN_SEPARATION' }
  })

  await logAudit("REQUEST_SEPARATION_STARTED", "MaterialRequest", requestId)

  revalidatePath(`/requests/${requestId}`)
  revalidatePath("/requests")
}

export async function fulfillRequestAction(formData: FormData) {
  const session = await requireActionPermission('REQUEST_FULFILL')

  const requestId = formData.get("requestId") as string
  
  const itemKeys = Array.from(formData.keys()).filter(k => k.startsWith('delivery_quantity_'))
  
  const deliveredItems = itemKeys.map(key => {
    const uniqueSuffix = key.replace('delivery_quantity_', '')
    return {
      itemId: uniqueSuffix,
      locationId: formData.get(`delivery_location_${uniqueSuffix}`) as string,
      quantity: Number(formData.get(`delivery_quantity_${uniqueSuffix}`))
    }
  }).filter(d => d.quantity > 0 && d.locationId && d.itemId)

  if (deliveredItems.length === 0) {
    throw new Error("Nenhuma quantidade informada para entrega.")
  }

  await deliverMaterialRequest(requestId, session.userId, deliveredItems)

  revalidatePath(`/requests/${requestId}`)
  revalidatePath("/requests")
  redirect(`/requests/${requestId}`)
}
