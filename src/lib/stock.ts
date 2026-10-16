import { db } from "./db"
import { Prisma } from "@prisma/client"
import { logAudit } from "./audit"
import { assertWarehouseAccess } from "./dal"

export type StockMovementType = 'ENTRY' | 'EXIT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'RETURN'

export interface CreateStockMovementParams {
  productId: string
  warehouseId: string
  locationId: string
  type: StockMovementType
  quantity: number
  unitCost?: number | null
  totalCost?: number | null
  referenceType?: string | null
  referenceId?: string | null
  documentNumber?: string | null
  reason?: string | null
  notes?: string | null
  performedById: string
}

export async function createStockMovement(
  params: CreateStockMovementParams,
  tx?: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
) {
  const prisma = tx || db
  await assertWarehouseAccess(params.warehouseId, params.performedById)

  if (params.quantity === 0) {
    throw new Error("Quantidade da movimentação não pode ser zero.")
  }

  const [product, warehouse, location] = await Promise.all([
    prisma.product.findUnique({ where: { id: params.productId } }),
    prisma.warehouse.findUnique({ where: { id: params.warehouseId } }),
    prisma.warehouseLocation.findUnique({ where: { id: params.locationId } })
  ])

  if (!product) throw new Error("Produto não encontrado.")
  if (!warehouse) throw new Error("Almoxarifado não encontrado.")
  if (!location) throw new Error("Localização não encontrada.")
  if (location.warehouseId !== params.warehouseId) {
    throw new Error("A localização não pertence ao almoxarifado selecionado.")
  }

  const isOut = ['EXIT', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'].includes(params.type)
  const movementValue = isOut ? -Math.abs(params.quantity) : Math.abs(params.quantity)

  const movement = await prisma.stockMovement.create({
    data: {
      productId: params.productId,
      warehouseId: params.warehouseId,
      locationId: params.locationId,
      type: params.type,
      quantity: movementValue,
      unitCost: params.unitCost,
      totalCost: params.totalCost,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      documentNumber: params.documentNumber,
      reason: params.reason,
      notes: params.notes,
      performedById: params.performedById,
    }
  })

  let newStock

  if (isOut) {
    // Débito atômico com guarda de saldo: elimina a corrida entre leitura e escrita.
    const debited = await prisma.stock.updateMany({
      where: {
        productId: params.productId,
        locationId: params.locationId,
        quantity: { gte: Math.abs(movementValue) }
      },
      data: { quantity: { increment: movementValue } }
    })

    if (debited.count === 0) {
      const currentStock = await prisma.stock.findUnique({
        where: {
          productId_locationId: {
            productId: params.productId,
            locationId: params.locationId,
          }
        }
      })
      throw new Error(`Estoque insuficiente na localização ${location.code}. Saldo atual: ${currentStock?.quantity ?? 0}`)
    }

    newStock = await prisma.stock.findUniqueOrThrow({
      where: {
        productId_locationId: {
          productId: params.productId,
          locationId: params.locationId,
        }
      }
    })
  } else {
    newStock = await prisma.stock.upsert({
      where: {
        productId_locationId: {
          productId: params.productId,
          locationId: params.locationId,
        }
      },
      update: {
        quantity: { increment: movementValue }
      },
      create: {
        productId: params.productId,
        warehouseId: params.warehouseId,
        locationId: params.locationId,
        quantity: movementValue,
        reservedQuantity: 0
      }
    })
  }

  // Atualiza o custo médio se for uma entrada ou ajuste de entrada com custo informado
  if (['ENTRY', 'ADJUSTMENT_IN'].includes(params.type) && params.unitCost != null) {
    const totals = await prisma.stock.aggregate({
      where: { productId: params.productId },
      _sum: { quantity: true }
    })
    const totalStockAfter = Number(totals._sum.quantity || 0)
    const totalStockBefore = totalStockAfter - movementValue
    
    let newAverageCost = params.unitCost
    if (totalStockBefore > 0 && totalStockAfter > 0) {
      const currentAverageCost = Number(product.averageCost || 0)
      newAverageCost = ((totalStockBefore * currentAverageCost) + (movementValue * params.unitCost)) / totalStockAfter
    }

    await prisma.product.update({
      where: { id: params.productId },
      data: { averageCost: newAverageCost }
    })
  }

  return { movement, stock: newStock }
}

export interface DeliveryItemInput {
  itemId: string
  locationId: string
  quantity: number
}

export async function deliverMaterialRequest(requestId: string, userId: string, deliveredItems: DeliveryItemInput[], outerTx?: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) {
  const run = async (tx: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => {
    const request = await tx.materialRequest.findUnique({
      where: { id: requestId },
      include: { items: true }
    })

    if (!request) throw new Error("Requisição não encontrada.")
    await assertWarehouseAccess(request.warehouseId, userId)
    if (request.status === 'FULFILLED') throw new Error("A requisição já foi totalmente atendida.")

    for (const delivery of deliveredItems) {
      if (delivery.quantity <= 0) continue

      const item = request.items.find(i => i.id === delivery.itemId)
      if (!item) throw new Error(`Item ${delivery.itemId} não pertence a esta requisição.`)

      const pendingQuantity = Number(item.approvedQuantity) - Number(item.deliveredQuantity)
      if (delivery.quantity > pendingQuantity) {
        throw new Error("A quantidade de entrega não pode ser maior que a quantidade pendente aprovada.")
      }

      await createStockMovement({
        productId: item.productId,
        warehouseId: request.warehouseId,
        locationId: delivery.locationId,
        type: 'EXIT',
        quantity: delivery.quantity,
        referenceType: 'MATERIAL_REQUEST',
        referenceId: request.id,
        documentNumber: request.requestNumber,
        reason: 'Saída por requisição de material',
        performedById: userId
      }, tx)

      await tx.materialRequestItem.update({
        where: { id: item.id },
        data: {
          deliveredQuantity: { increment: delivery.quantity }
        }
      })
    }

    const updatedRequest = await tx.materialRequest.findUnique({
      where: { id: requestId },
      include: { items: true }
    })

    const allFulfilled = updatedRequest?.items.every(i => Number(i.deliveredQuantity) >= Number(i.approvedQuantity))
    const newStatus = allFulfilled ? 'FULFILLED' : 'PARTIALLY_FULFILLED'

    await tx.materialRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        fulfilledAt: new Date(),
        completedAt: allFulfilled ? new Date() : undefined
      }
    })

    // Log de auditoria dentro da mesma transação para manter consistência
    await logAudit("REQUEST_FULFILLED", "MaterialRequest", requestId, { status: newStatus }, userId, tx)

    return updatedRequest
  }
  if (outerTx) return run(outerTx)
  return db.$transaction(run)
}

export async function consolidateInventory(
  inventoryId: string,
  userId: string,
  options?: { onlyCountedItems?: boolean }
) {
  return await db.$transaction(async (tx) => {
    const inv = await tx.inventory.findUnique({
      where: { id: inventoryId },
      include: {
        locations: true,
        collections: {
          where: { status: 'SUBMITTED' },
          include: { items: true }
        }
      }
    })

    if (!inv) throw new Error("Inventário não encontrado.")
    await assertWarehouseAccess(inv.warehouseId, userId)
    
    // Deleta divergências pendentes/revisadas anteriores para recalcular
    await tx.inventoryDivergence.deleteMany({
      where: {
        inventoryId,
        status: { in: ['PENDING', 'REVIEWED'] }
      }
    })

    const countedMap = new Map<string, number>()
    
    for (const col of inv.collections) {
      for (const item of col.items) {
        const key = `${col.locationId}_${item.productId}`
        const current = countedMap.get(key) || 0
        countedMap.set(key, current + Number(item.quantity))
      }
    }

    // Por padrão, compara APENAS os produtos que foram efetivamente bipados/coletados na contagem.
    // Produtos não bipados permanecem inalterados no estoque e não geram falsas divergências.
    const isPartialScope = options?.onlyCountedItems ?? true

    const locationIds = inv.locations.map(l => l.locationId)
    const systemStocks = await tx.stock.findMany({
      where: { locationId: { in: locationIds } }
    })
    
    const systemStockMap = new Map<string, number>()
    for (const sys of systemStocks) {
      const key = `${sys.locationId}_${sys.productId}`
      systemStockMap.set(key, Number(sys.quantity))
      if (!isPartialScope && !countedMap.has(key)) {
        countedMap.set(key, 0)
      }
    }

    let hasDivergences = false
    const divergencesData = []

    for (const [key, countedQty] of countedMap.entries()) {
      const [locId, prodId] = key.split('_')
      
      const sysQty = systemStockMap.get(key) || 0
      const diff = countedQty - sysQty

      if (diff !== 0) {
        hasDivergences = true
        divergencesData.push({
          inventoryId,
          locationId: locId,
          productId: prodId,
          systemQuantity: sysQty,
          countedQuantity: countedQty,
          difference: diff,
          status: 'PENDING'
        })
      }
    }

    if (divergencesData.length > 0) {
      await tx.inventoryDivergence.createMany({
        data: divergencesData
      })
    }

    const totalRemainingDivergences = await tx.inventoryDivergence.count({
      where: { inventoryId, status: { in: ['PENDING', 'REVIEWED'] } }
    })

    await tx.inventory.update({
      where: { id: inventoryId },
      data: {
        ...(options?.onlyCountedItems ? { type: 'PARTIAL' } : {}),
        status: (hasDivergences || totalRemainingDivergences > 0) ? 'CONFERENCE' : 'COMPLETED',
        finishedAt: new Date(),
        finishedById: userId
      }
    })
  }, {
    timeout: 30000 // 30 seconds timeout for large inventories
  })
}

export async function executeDivergenceAdjustment(divergenceId: string, userId: string, notes?: string) {
  return await db.$transaction(async (tx) => {
    const div = await tx.inventoryDivergence.findUnique({
      where: { id: divergenceId },
      include: { inventory: true }
    })

    if (!div) throw new Error("Divergência não encontrada.")
    await assertWarehouseAccess(div.inventory.warehouseId, userId)
    if (div.status !== 'APPROVED') throw new Error("A divergência precisa estar aprovada para ser ajustada.")

    const diffNum = Number(div.difference)
    const moveType = diffNum > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'
    
    await createStockMovement({
      productId: div.productId,
      warehouseId: div.inventory.warehouseId,
      locationId: div.locationId,
      type: moveType,
      quantity: Math.abs(diffNum),
      referenceType: 'INVENTORY_ADJUSTMENT',
      referenceId: div.id,
      reason: 'Ajuste de inventário aprovado',
      notes: notes || 'Ajuste automático via consolidação',
      performedById: userId
    }, tx)

    await tx.inventoryDivergence.update({
      where: { id: divergenceId },
      data: { status: 'ADJUSTED', updatedAt: new Date() }
    })
  })
}

export interface ReturnItemInput {
  productId: string
  locationId: string
  quantity: number
  unitId: string
  condition: 'GOOD' | 'DAMAGED' | 'UNUSABLE'
  notes?: string
}

export async function receiveMaterialReturn(returnId: string, userId: string, items: ReturnItemInput[], outerTx?: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) {
  const run = async (tx: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => {
    const ret = await tx.materialReturn.findUnique({
      where: { id: returnId },
      include: { items: true }
    })

    if (!ret) throw new Error("Devolução não encontrada.")
    await assertWarehouseAccess(ret.warehouseId, userId)
    if (ret.status !== 'DRAFT') throw new Error("Esta devolução já foi recebida ou cancelada.")

    for (const item of items) {
      const location = await tx.warehouseLocation.findUnique({ where: { id: item.locationId } })
      if (!location || location.warehouseId !== ret.warehouseId) throw new Error("Localização inválida para a devolução.")
      await tx.materialReturnItem.create({
        data: {
          returnId,
          productId: item.productId,
          locationId: item.locationId,
          quantity: item.quantity,
          unitId: item.unitId,
          condition: item.condition,
          notes: item.notes
        }
      })

      if (item.condition === 'GOOD') {
        await createStockMovement({
          productId: item.productId,
          warehouseId: ret.warehouseId,
          locationId: item.locationId,
          type: 'RETURN',
          quantity: item.quantity,
          referenceType: 'MATERIAL_RETURN',
          referenceId: ret.id,
          documentNumber: ret.returnNumber,
          reason: 'Devolução de material em bom estado',
          notes: item.notes,
          performedById: userId
        }, tx)
      }
    }

    await tx.materialReturn.update({
      where: { id: returnId },
      data: {
        status: 'RECEIVED',
        receivedById: userId,
        updatedAt: new Date()
      }
    })
  }
  return outerTx ? run(outerTx) : db.$transaction(run)
}

export interface TransferItemInput {
  productId: string
  quantity: number
  unitId: string
  notes?: string
}

export async function executeStockTransfer(
  transferId: string, 
  userId: string,
  items: TransferItemInput[],
  outerTx?: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
) {
  const run = async (tx: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id: transferId }
    })

    if (!transfer) throw new Error("Transferência não encontrada.")
    await assertWarehouseAccess(transfer.sourceWarehouseId, userId)
    await assertWarehouseAccess(transfer.destinationWarehouseId, userId)
    if (transfer.status !== 'DRAFT') throw new Error("Esta transferência já foi executada ou cancelada.")

    for (const item of items) {
      // Cria a saída
      await createStockMovement({
        productId: item.productId,
        warehouseId: transfer.sourceWarehouseId,
        locationId: transfer.sourceLocationId,
        type: 'TRANSFER_OUT',
        quantity: item.quantity,
        referenceType: 'TRANSFER',
        referenceId: transfer.id,
        documentNumber: transfer.transferNumber,
        reason: `Transferência para almoxarifado destino`,
        notes: item.notes,
        performedById: userId
      }, tx)

      // Cria a entrada
      await createStockMovement({
        productId: item.productId,
        warehouseId: transfer.destinationWarehouseId,
        locationId: transfer.destinationLocationId,
        type: 'TRANSFER_IN',
        quantity: item.quantity,
        referenceType: 'TRANSFER',
        referenceId: transfer.id,
        documentNumber: transfer.transferNumber,
        reason: `Recebimento de transferência`,
        notes: item.notes,
        performedById: userId
      }, tx)

      // Registra o item
      await tx.stockTransferItem.create({
        data: {
          transferId,
          productId: item.productId,
          quantity: item.quantity,
          unitId: item.unitId,
          notes: item.notes
        }
      })
    }

    await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'COMPLETED',
        completedById: userId,
        updatedAt: new Date()
      }
    })
  }
  return outerTx ? run(outerTx) : db.$transaction(run)
}
