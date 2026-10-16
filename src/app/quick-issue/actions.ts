"use server"

import { db } from "@/lib/db"
import { assertWarehouseAccess, warehouseScopeIds } from "@/lib/dal"
import { revalidatePath } from "next/cache"
import { createWithUniqueNumber } from "@/lib/sequential"
import { requireActionPermission } from "@/lib/action-guard"
import { createStockMovement } from "@/lib/stock"

export async function verifyEmployeeQR(qrToken: string) {
  let session
  try {
    session = await requireActionPermission('STOCK_EXIT')
  } catch {
    return { error: "Não autorizado." }
  }
  
  const trimmed = qrToken.trim()
  const cleanDigits = trimmed.replace(/\D/g, "")
  const withoutEmpPrefix = trimmed.replace(/^EMP-/i, "")

  // 1. Localizar usuário pelo token QR, código de funcionário, CPF, e-mail ou ID
  const employee = await db.user.findFirst({
    where: {
      OR: [
        { qrToken: trimmed },
        { qrToken: `EMP-${trimmed}` },
        { employeeCode: trimmed },
        { employeeCode: withoutEmpPrefix },
        { email: trimmed },
        { id: trimmed },
        ...(cleanDigits.length >= 8 ? [{ document: cleanDigits }, { document: trimmed }] : []),
      ]
    },
    include: {
      worksiteAccesses: {
        include: { worksite: true }
      }
    }
  })
  
  if (!employee) return { error: "Funcionário não encontrado ou código inválido." }
  if (employee.status !== "ACTIVE") return { error: "Funcionário inativo." }
  if (employee.qrToken === trimmed && employee.qrStatus !== "ACTIVE") return { error: "QR Code revogado." }
  
  // 2. Obra autorizada do funcionário ou obra ativa padrão
  let worksite: any = null
  if (employee.worksiteAccesses.length > 0) {
    worksite = employee.worksiteAccesses[0].worksite
  } else {
    worksite = await db.worksite.findFirst({ where: { status: "ACTIVE" } })
  }
  
  if (!worksite || worksite.status !== "ACTIVE") {
    return { error: "Nenhuma obra ativa encontrada para este funcionário." }
  }
  
  // 3. Pegar um almoxarifado padrão dessa obra para registrar a saída
  const scope = await warehouseScopeIds(session.userId)
  const warehouse = await db.warehouse.findFirst({
    where: { worksiteId: worksite.id, status: "ACTIVE", id: { in: scope ?? undefined } }
  })
  
  if (!warehouse) {
    return { error: "Nenhum almoxarifado ativo encontrado para esta obra." }
  }
  
  return {
    success: true,
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      employeeCode: employee.employeeCode,
      document: employee.document,
    },
    worksite: {
      id: worksite.id,
      name: worksite.name,
    },
    warehouse: {
      id: warehouse.id,
      name: warehouse.name,
    }
  }
}

export async function getProductStockForQuickIssue(worksiteId: string, warehouseId: string, productCode: string) {
  let session
  try {
    session = await requireActionPermission('STOCK_EXIT')
  } catch {
    return { error: "Não autorizado." }
  }

  // Verificar se o almoxarife/operador logado tem acesso à obra (no backend!)
  const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, worksiteId, status: 'ACTIVE' } })
  if (!warehouse) return { error: "Almoxarifado inválido para esta obra." }
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

  // Buscar o estoque SOMENTE na obra informada
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
    return { error: "Este produto não possui estoque disponível nesta obra." }
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
  const warehouse = await db.warehouse.findFirst({ where: { id: payload.warehouseId, worksiteId: payload.worksiteId, status: 'ACTIVE' } })
  if (!warehouse) return { error: "Almoxarifado inválido para esta obra." }
  try {
    await assertWarehouseAccess(payload.warehouseId, session.userId)
  } catch {
    return { error: "Você não tem acesso a este almoxarifado." }
  }
  const employee = await db.user.findFirst({ where: { id: payload.employeeId, status: 'ACTIVE', qrStatus: 'ACTIVE', worksiteAccesses: { some: { worksiteId: payload.worksiteId } } } })
  if (!employee) return { error: "Funcionário não autorizado nesta obra." }
  
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
          worksiteId: payload.worksiteId,
          warehouseId: payload.warehouseId,
          status: "COMPLETED",
          completedAt: new Date()
        }
      })

      // 2. Processar cada item
      for (const item of payload.items) {
        // Buscar estoques em todas as localizações dessa obra para esse produto, ordenados
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
              worksiteId: payload.worksiteId
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
    return { success: true, issueNumber: issueResult.issueNumber }
    
  } catch (error) {
    console.error("Transaction Error:", error)
    return { error: error instanceof Error ? error.message : "Erro ao processar entrega." }
  }
}
