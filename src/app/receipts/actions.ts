"use server"

import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { createStockMovement } from "@/lib/stock"
import { logAudit } from "@/lib/audit"
import { requireActionPermission } from "@/lib/action-guard"
import { assertWarehouseAccess } from "@/lib/dal"
import { pushMovimentoAoInformakon } from "@/lib/informakon"

const UNCATEGORIZED = "__sem_categoria__"

async function resolveWarehouseSource(warehouseId: string | null | undefined) {
  if (!warehouseId) return null
  const wh = await db.warehouse.findUnique({ where: { id: warehouseId }, select: { source: true } })
  return wh?.source ?? null
}

/** Categorias de fornecedor com contagem, filtradas pela empresa (MGA/CV) do almoxarifado */
export async function listSupplierCategoriesAction(warehouseId: string | null) {
  await requireActionPermission('STOCK_ENTRY')
  const source = await resolveWarehouseSource(warehouseId)

  const grouped = await db.supplier.groupBy({
    by: ['category'],
    where: { status: 'ACTIVE', source: source ?? undefined },
    _count: { _all: true },
  })

  return grouped
    .map((g) => ({
      key: g.category?.trim() || UNCATEGORIZED,
      label: g.category?.trim() || "Sem categoria",
      count: g._count._all,
    }))
    .sort((a, b) => {
      if (a.key === UNCATEGORIZED) return 1
      if (b.key === UNCATEGORIZED) return -1
      return a.label.localeCompare(b.label, "pt-BR")
    })
}

/** Busca fornecedores sob demanda (nome, código ERP ou CNPJ/CPF), filtrados pela empresa do almoxarifado */
export async function searchSuppliersAction(params: {
  warehouseId?: string | null
  category?: string | null
  search?: string
}) {
  await requireActionPermission('STOCK_ENTRY')
  const source = await resolveWarehouseSource(params.warehouseId)
  const search = params.search?.trim()

  return db.supplier.findMany({
    where: {
      status: 'ACTIVE',
      source: source ?? undefined,
      category: params.category === UNCATEGORIZED ? null : params.category ?? undefined,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { erpCode: { contains: search, mode: 'insensitive' as const } },
          { document: { contains: search } },
        ],
      } : {}),
    },
    select: { id: true, name: true, document: true, source: true, erpCode: true, category: true },
    orderBy: [{ registeredAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
    take: 80,
  })
}

export async function createReceiptAction(formData: FormData) {
  const session = await requireActionPermission('STOCK_ENTRY')

  const supplierId = formData.get("supplierId") as string
  const warehouseId = formData.get("warehouseId") as string
  await assertWarehouseAccess(warehouseId, session.userId)

  // Fornecedor precisa pertencer à empresa do almoxarifado (MGA ou CV) — ou não ter vínculo
  const [whSource, supSource] = await Promise.all([
    db.warehouse.findUnique({ where: { id: warehouseId }, select: { source: true } }),
    db.supplier.findUnique({ where: { id: supplierId }, select: { source: true } }),
  ])
  if (whSource?.source && supSource?.source && whSource.source !== supSource.source) {
    return { success: false, error: "supplier_wrong_company" }
  }

  const documentNumber = formData.get("documentNumber") as string || null
  const documentDateStr = formData.get("documentDate") as string || null
  
  // Como é complexo passar múltiplos itens por FormData nativo (arrays),
  // em um app real com UI dinâmica, normalmente receberíamos um JSON oculto 
  // ou faríamos parse dos keys. Vamos ler os dados como arrays usando getAll.
  const productIds = formData.getAll("item_productId") as string[]
  const locationIds = formData.getAll("item_locationId") as string[]
  const quantities = formData.getAll("item_quantity") as string[]
  const unitCosts = formData.getAll("item_unitCost") as string[]
  const actionType = formData.get("actionType") as string // "DRAFT" ou "COMPLETED"

  if (!supplierId || !warehouseId || productIds.length === 0) {
    return { success: false, error: "missing_fields" }
  }

  try {
    const documentDate = documentDateStr ? new Date(documentDateStr) : null
    
    let subtotal = 0
    const itemsData = productIds.map((productId, index) => {
      const quantity = parseInt(quantities[index]) || 0
      const unitCost = parseFloat(unitCosts[index]) || 0
      const totalCost = quantity * unitCost
      subtotal += totalCost

      return {
        productId,
        locationId: locationIds[index],
        quantity,
        unitCost,
        totalCost,
      }
    }).filter(i => Number(i.quantity) > 0)

    if (itemsData.length === 0) {
      return { success: false, error: "no_valid_items" }
    }
    const locations = await db.warehouseLocation.count({ where: { id: { in: itemsData.map(item => item.locationId) }, warehouseId } })
    if (locations !== new Set(itemsData.map(item => item.locationId)).size) return { success: false, error: "invalid_location" }

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
          items: {
            create: itemsData
          }
        }
      })
      await logAudit("RECEIPT_CREATED", "StockReceipt", receipt.id, { status: "DRAFT" })
    } else if (actionType === "COMPLETED") {
      const completedReceiptId = await db.$transaction(async (tx) => {
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
            items: {
              create: itemsData
            }
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
        await logAudit("RECEIPT_CREATED", "StockReceipt", receipt.id, { status: "COMPLETED" })
        return receipt.id
      })
      // Write-back: reflete a entrada no Informakon (não desfaz a operação local)
      const erp = await pushMovimentoAoInformakon({
        tipo: 'entrada',
        warehouseId,
        itens: itemsData.map(i => ({ productId: i.productId, quantidade: i.quantity, valor: i.totalCost })),
        docNumero: documentNumber || `RCB-${completedReceiptId.slice(-8).toUpperCase()}`,
        clienteRef: `receipt-${completedReceiptId}`,
      })
      return { success: true, informakon: erp }
    }

    return { success: true }
  } catch (error) {
    console.error("Erro ao salvar recebimento", error)
    return { success: false, error: "create_failed" }
  }
}

export async function confirmReceiptAction(formData: FormData) {
  const session = await requireActionPermission('STOCK_ENTRY')

  const receiptId = formData.get("receiptId") as string
  if (!receiptId) throw new Error("ID do recebimento não informado")

  const receipt = await db.stockReceipt.findUnique({
    where: { id: receiptId },
    include: { items: true }
  })

  if (!receipt) throw new Error("Recebimento não encontrado")
  await assertWarehouseAccess(receipt.warehouseId, session.userId)
  if (receipt.status !== "DRAFT") throw new Error("Apenas recebimentos em rascunho podem ser confirmados")

  try {
    await db.$transaction(async (tx) => {
      await tx.stockReceipt.update({
        where: { id: receipt.id },
        data: {
          status: 'COMPLETED',
          receivedAt: new Date()
        }
      })

      for (const item of receipt.items) {
        await createStockMovement({
          productId: item.productId,
          warehouseId: receipt.warehouseId,
          locationId: item.locationId,
          type: 'ENTRY',
          quantity: Number(item.quantity),
          unitCost: item.unitCost ? Number(item.unitCost) : null,
          totalCost: item.totalCost ? Number(item.totalCost) : null,
          referenceType: 'RECEIPT',
          referenceId: receipt.id,
          documentNumber: receipt.documentNumber,
          performedById: session.userId
        }, tx)
      }
    })

    await logAudit("RECEIPT_CONFIRMED", "StockReceipt", receipt.id, { status: "COMPLETED" })

    // Write-back: a confirmação do rascunho também vira entrada no Informakon
    await pushMovimentoAoInformakon({
      tipo: 'entrada',
      warehouseId: receipt.warehouseId,
      itens: receipt.items.map(i => ({ productId: i.productId, quantidade: Number(i.quantity), valor: i.totalCost ? Number(i.totalCost) : null })),
      docNumero: receipt.documentNumber || `RCB-${receipt.id.slice(-8).toUpperCase()}`,
      clienteRef: `receipt-${receipt.id}`,
    })
  } catch (error) {
    console.error("Erro ao confirmar recebimento", error)
    throw new Error(error instanceof Error ? error.message : "Erro ao processar a confirmação do recebimento no estoque.")
  }

  redirect(`/receipts/${receipt.id}`)
}
