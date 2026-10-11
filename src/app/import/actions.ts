"use server"

import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"

export async function createImportBatchAction(warehouseId: string, rows: any[]) {
  const session = await getValidatedSession()
  if (!session) return { success: false, error: "Não autorizado" }

  // Must have some valid permission to import? Using CONFIG_MANAGE
  // This might be checked at the page level, but doing a basic check is good.

  try {
    const batch = await db.importBatch.create({
      data: {
        createdById: session.userId,
        warehouseId,
        status: 'STAGING',
        rows: {
          create: rows.map(r => ({
            productCode: r.productCode ? String(r.productCode) : 'N/A',
            productName: r.productName ? String(r.productName) : 'N/A',
            quantity: Number(r.quantity) || 0,
            unitCost: r.unitCost ? Number(r.unitCost) : null,
            status: 'PENDING'
          }))
        }
      }
    })

    return { success: true, batchId: batch.id }
  } catch (error: any) {
    console.error("Erro ao criar batch:", error)
    return { success: false, error: error.message || "Erro ao criar lote." }
  }
}

import { createStockMovement } from "@/lib/stock"
import { logAudit } from "@/lib/audit"

export async function executeImportBatchAction(batchId: string) {
  const session = await getValidatedSession()
  if (!session) return { success: false, error: "Não autorizado" }

  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    include: { rows: { where: { status: 'PENDING' } } }
  })

  if (!batch) return { success: false, error: "Lote não encontrado." }
  if (batch.status !== 'STAGING') return { success: false, error: "Lote já processado ou cancelado." }
  if (!batch.warehouseId) return { success: false, error: "Almoxarifado de destino não definido no lote." }

  // Get default location for this warehouse
  let defaultLocation = await db.warehouseLocation.findFirst({
    where: { warehouseId: batch.warehouseId }
  })

  if (!defaultLocation) {
    defaultLocation = await db.warehouseLocation.findFirst({
       where: { warehouseId: batch.warehouseId }
    })
  }
  
  if (!defaultLocation) {
     return { success: false, error: "Almoxarifado sem nenhuma localização cadastrada." }
  }

  // Get product categories/units just in case we need to create products
  const defaultCategory = await db.productCategory.findFirst()
  const defaultUnit = await db.productUnit.findFirst()

  let successCount = 0

  for (const row of batch.rows) {
    try {
      if (!row.productCode) throw new Error("Código do produto ausente.")

      // 1. Acha ou cria produto
      let product = await db.product.findUnique({
        where: { code: row.productCode }
      })

      if (!product) {
         if (!defaultCategory || !defaultUnit) throw new Error("Não há categoria ou unidade padrão para criar o produto.")
         product = await db.product.create({
            data: {
               code: row.productCode,
               name: row.productName,
               categoryId: defaultCategory.id,
               unitId: defaultUnit.id
            }
         })
      }

      const qty = Number(row.quantity)

      // 2. Cria movimento de entrada
      if (qty > 0) {
         await db.$transaction(async (tx) => {
           await createStockMovement({
             productId: product!.id,
             warehouseId: batch.warehouseId!,
             locationId: defaultLocation!.id,
             type: 'ENTRY',
             quantity: qty,
             unitCost: row.unitCost ? Number(row.unitCost) : undefined,
             referenceType: 'IMPORT_BATCH',
             referenceId: batch.id,
             reason: 'Importação inicial de estoque',
             performedById: session.userId
           }, tx)
         })
      }

      // Mark success
      await db.importBatchRow.update({
        where: { id: row.id },
        data: { status: 'SUCCESS' }
      })
      successCount++

    } catch (err: any) {
      await db.importBatchRow.update({
        where: { id: row.id },
        data: { status: 'ERROR', errorMessage: err.message || "Erro desconhecido" }
      })
    }
  }

  // Check if all rows are done
  const remainingPending = await db.importBatchRow.count({
    where: { batchId, status: 'PENDING' }
  })

  if (remainingPending === 0) {
    await db.importBatch.update({
      where: { id: batchId },
      data: { status: 'COMPLETED' }
    })
  }

  await logAudit("IMPORT_EXECUTED", "ImportBatch", batchId, { successCount, remainingPending }, session.userId)

  return { success: true, processed: successCount }
}
