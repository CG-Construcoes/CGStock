"use server"

import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { getAccessibleWorksiteIds } from "@/lib/context"
import { revalidatePath } from "next/cache"
import { createWithUniqueNumber } from "@/lib/sequential"

export async function verifyEmployeeQR(qrToken: string) {
  const session = await getValidatedSession()
  if (!session) return { error: "Não autorizado." }
  
  // 1. Localizar usuário pelo token
  const employee = await db.user.findUnique({
    where: { qrToken },
    include: {
      worksiteAccesses: {
        include: { worksite: true }
      }
    }
  })
  
  if (!employee) return { error: "Funcionário não encontrado ou QR inválido." }
  if (employee.status !== "ACTIVE") return { error: "Funcionário inativo." }
  if (employee.qrStatus !== "ACTIVE") return { error: "QR Code revogado." }
  
  // 2. Verificar se o funcionário tem alguma obra autorizada
  if (employee.worksiteAccesses.length === 0) {
    return { error: "Funcionário sem obra autorizada vinculada." }
  }
  
  // Para a Entrega Rápida, usaremos a primeira obra dele (ou a principal)
  // Em uma evolução futura, podemos listar e deixar ele escolher se tiver várias.
  const primaryAccess = employee.worksiteAccesses[0]
  const worksite = primaryAccess.worksite
  
  if (worksite.status !== "ACTIVE") {
    return { error: "Obra do funcionário está inativa." }
  }
  
  // 3. Pegar um almoxarifado padrão dessa obra para registrar a saída
  const warehouse = await db.warehouse.findFirst({
    where: { worksiteId: worksite.id, status: "ACTIVE" }
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

export async function getProductStockForQuickIssue(worksiteId: string, productCode: string) {
  const session = await getValidatedSession()
  if (!session) return { error: "Não autorizado." }

  // Verificar se o almoxarife/operador logado tem acesso à obra (no backend!)
  const allowedWorksites = await getAccessibleWorksiteIds()
  if (!allowedWorksites.includes(worksiteId)) {
    return { error: "Você não tem permissão para operar nesta obra." }
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
      warehouse: { worksiteId }
    },
    include: {
      location: true
    }
  })

  const availableStocks = stocks.filter(s => s.quantity > 0)
  
  if (availableStocks.length === 0) {
    return { error: "Este produto não possui estoque disponível nesta obra." }
  }

  const totalAvailable = availableStocks.reduce((sum, s) => sum + s.quantity, 0)

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
      quantity: s.quantity
    })).sort((a, b) => b.quantity - a.quantity) // Sugerir pegar da que tem mais primeiro, ou FIFO se houvesse data
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
  const session = await getValidatedSession()
  if (!session) return { error: "Não autorizado." }
  
  const allowedWorksites = await getAccessibleWorksiteIds()
  if (!allowedWorksites.includes(payload.worksiteId)) {
    return { error: "Você não tem permissão para registrar saídas nesta obra." }
  }
  
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
            warehouse: { worksiteId: payload.worksiteId },
            quantity: { gt: 0 }
          },
          orderBy: { quantity: 'desc' }
        })
        
        let remainingToFulfill = item.requestedQuantity
        
        const totalAvailable = stocks.reduce((sum, s) => sum + s.quantity, 0)
        if (remainingToFulfill > totalAvailable) {
          throw new Error(`Estoque insuficiente para o produto ID: ${item.productId}`)
        }
        
        // Alocar das localizações automaticamente
        for (const stock of stocks) {
          if (remainingToFulfill <= 0) break;
          
          const qtyToTake = Math.min(stock.quantity, remainingToFulfill)
          
          // Criar QuickIssueItem
          await tx.quickIssueItem.create({
            data: {
              issueId: issue.id,
              productId: item.productId,
              locationId: stock.locationId,
              quantity: qtyToTake
            }
          })
          
          // Debitar Estoque
          await tx.stock.update({
            where: { id: stock.id },
            data: { quantity: { decrement: qtyToTake } }
          })
          
          // Gerar StockMovement
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: stock.warehouseId,
              locationId: stock.locationId,
              type: "EXIT",
              quantity: qtyToTake,
              referenceType: "QUICK_ISSUE",
              referenceId: issue.id,
              documentNumber: issueNumber,
              performedById: session.userId,
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
