"use server"

import { db } from "@/lib/db"
import { assertWarehouseAccess } from "@/lib/dal"
import { revalidatePath } from "next/cache"
import { createWithUniqueNumber } from "@/lib/sequential"
import { requireActionPermission } from "@/lib/action-guard"
import { createStockMovement } from "@/lib/stock"
import { pushMovimentoAoInformakon } from "@/lib/informakon"
import { ensureWarehouseWorksite, resolveEmployeeForOperatorWarehouse } from "@/lib/employee-warehouse"

export async function verifyEmployeeQR(
  qrToken: string,
  options?: { confirmTransfer?: boolean; explicitWarehouseId?: string }
) {
  let session
  try {
    session = await requireActionPermission('STOCK_EXIT')
  } catch {
    return { error: "Não autorizado." }
  }

  return resolveEmployeeForOperatorWarehouse(qrToken, session.userId, options)
}

export async function getProductStockForQuickIssue(worksiteId: string, warehouseId: string, productCode: string) {
  let session
  try {
    session = await requireActionPermission('STOCK_EXIT')
  } catch {
    return { error: "Não autorizado." }
  }

  // Valida pelo almoxarifado (sem depender de obra)
  const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, status: 'ACTIVE' } })
  if (!warehouse) return { error: "Almoxarifado inválido ou inativo." }
  try {
    await assertWarehouseAccess(warehouseId, session.userId)
  } catch {
    return { error: "Você não tem acesso a este almoxarifado." }
  }

  // Buscar o produto primeiro globalmente
  const product = await db.product.findFirst({
    where: { 
      code: { contains: productCode, mode: 'insensitive' }
    },
    include: { unit: true },
    orderBy: { code: 'asc' }
  })
  
  if (!product) return { error: "Produto não encontrado no catálogo." }

  // Buscar o estoque SOMENTE no almoxarifado informado
  const stocks = await db.stock.findMany({
    where: {
      productId: product.id,
      warehouseId
    },
    include: {
      location: true
    }
  })

  const availableStocks = stocks.filter(s => Number(s.quantity) > 0)
  
  if (availableStocks.length === 0) {
    return { error: "Este produto não possui estoque disponível neste almoxarifado." }
  }

  const totalAvailable = availableStocks.reduce((sum, s) => sum + Number(s.quantity), 0)

  return {
    success: true,
    product: {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit.code
    },
    totalAvailable,
    locations: availableStocks.map(s => ({
      locationId: s.locationId,
      locationCode: s.location.code,
      quantity: Number(s.quantity)
    })).sort((a, b) => Number(b.quantity) - Number(a.quantity)) // Sugerir pegar da que tem mais primeiro, ou FIFO se houvesse data
  }
}

export async function confirmQuickIssue(payload: {
  employeeId: string,
  worksiteId: string,
  warehouseId: string,
  items: {
    productId: string,
    requestedQuantity: number
  }[]
}) {
  let session
  try {
    session = await requireActionPermission('STOCK_EXIT')
  } catch {
    return { error: "Não autorizado." }
  }
  const warehouse = await db.warehouse.findFirst({
    where: { id: payload.warehouseId, status: 'ACTIVE' },
    select: { id: true, code: true, name: true, worksiteId: true }
  })
  if (!warehouse) return { error: "Almoxarifado inválido ou inativo." }
  try {
    await assertWarehouseAccess(payload.warehouseId, session.userId)
  } catch {
    return { error: "Você não tem acesso a este almoxarifado." }
  }

  const employee = await db.user.findFirst({
    where: { id: payload.employeeId, status: 'ACTIVE', qrStatus: 'ACTIVE' },
  })
  if (!employee) return { error: "Funcionário não encontrado ou inativo." }

  const resolvedWorksite = await ensureWarehouseWorksite({
    id: warehouse.id,
    code: warehouse.code || "ALM",
    name: warehouse.name || "Almoxarifado",
    worksiteId: warehouse.worksiteId ?? payload.worksiteId ?? null,
  })
  const effectiveWorksiteId = resolvedWorksite.id
  
  if (!payload.items || payload.items.length === 0) {
    return { error: "Nenhum item informado." }
  }

  try {
    const issueResult = await createWithUniqueNumber(
      async (attempt) => {
        const issueCount = await db.quickIssue.count()
        return `ENT-${String(issueCount + 1 + attempt).padStart(6, '0')}`
      },
      (issueNumber) => db.$transaction(async (tx) => {
      // 1. Criar o QuickIssue master
      
      const issue = await tx.quickIssue.create({
        data: {
          issueNumber,
          operatorId: session.userId,
          recipientId: payload.employeeId,
          worksiteId: effectiveWorksiteId,
          warehouseId: payload.warehouseId,
          status: "COMPLETED",
          completedAt: new Date()
        }
      })

      // 2. Processar cada item
      for (const item of payload.items) {
        // Buscar estoques em todas as localizações desse almoxarifado para esse produto, ordenados
        const stocks = await tx.stock.findMany({
          where: {
            productId: item.productId,
            warehouseId: payload.warehouseId,
            quantity: { gt: 0 }
          },
          orderBy: { quantity: 'desc' }
        })
        
        let remainingToFulfill = Number(item.requestedQuantity)
        
        const totalAvailable = stocks.reduce((sum, s) => sum + Number(s.quantity), 0)
        if (remainingToFulfill > totalAvailable) {
          throw new Error(`Estoque insuficiente para o produto ID: ${item.productId}`)
        }
        
        // Alocar das localizações automaticamente
        for (const stock of stocks) {
          if (remainingToFulfill <= 0) break;
          
          const qtyToTake = Math.min(Number(stock.quantity), remainingToFulfill)
          
          // Criar QuickIssueItem
          await tx.quickIssueItem.create({
            data: {
              issueId: issue.id,
              productId: item.productId,
              locationId: stock.locationId,
              quantity: qtyToTake
            }
          })
          
          // Debitar estoque e gerar movimentação com guarda atômica de saldo
          const { movement } = await createStockMovement({
            productId: item.productId,
            warehouseId: stock.warehouseId,
            locationId: stock.locationId,
            type: "EXIT",
            quantity: qtyToTake,
            referenceType: "QUICK_ISSUE",
            referenceId: issue.id,
            documentNumber: issueNumber,
            reason: "Entrega rápida",
            performedById: session.userId
          }, tx)

          await tx.stockMovement.update({
            where: { id: movement.id },
            data: {
              recipientUserId: payload.employeeId,
              worksiteId: effectiveWorksiteId
            }
          })
          
          remainingToFulfill -= qtyToTake
        }
        
        // Double check
        if (remainingToFulfill > 0) {
          throw new Error(`Falha na alocação de prateleiras para o produto ID: ${item.productId}`)
        }
      }
      
      return issue
      })
    )
    
    revalidatePath("/quick-issue")
    revalidatePath("/reports/exits")

    // Write-back: saída no Informakon (itens agregados por produto)
    const byProduct = new Map<string, number>()
    for (const it of payload.items) byProduct.set(it.productId, (byProduct.get(it.productId) ?? 0) + Number(it.requestedQuantity))
    const erp = await pushMovimentoAoInformakon({
      tipo: 'saida',
      warehouseId: payload.warehouseId,
      itens: [...byProduct].map(([productId, quantidade]) => ({ productId, quantidade })),
      docNumero: issueResult.issueNumber,
      clienteRef: `issue-${issueResult.id}`,
      destinatario: employee.name ?? undefined,
    })
    return { success: true, issueNumber: issueResult.issueNumber, informakon: erp }
    
  } catch (error) {
    console.error("Transaction Error:", error)
    return { error: error instanceof Error ? error.message : "Erro ao processar entrega." }
  }
}
