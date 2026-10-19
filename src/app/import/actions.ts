"use server"

import { db } from "@/lib/db"
import { requireActionPermission } from "@/lib/action-guard"
import { assertWarehouseAccess } from "@/lib/dal"
import { logAudit } from "@/lib/audit"

export async function createImportBatchAction(warehouseId: string, rows: any[]) {
  const session = await requireActionPermission('CONFIG_MANAGE')

  await assertWarehouseAccess(warehouseId, session.userId)

  try {
    const batch = await db.importBatch.create({
      data: {
        createdById: session.userId,
        warehouseId,
        status: 'STAGING',
        rows: {
          create: rows.map(r => ({
            productCode: r.productCode ? String(r.productCode).trim() : 'N/A',
            productName: r.productName ? String(r.productName).trim() : 'N/A',
            quantity: Number(r.quantity) || 0,
            unitCost: r.unitCost != null && r.unitCost !== '' ? Number(r.unitCost) : null,
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

export async function executeImportBatchAction(batchId: string, rowIds?: string[]) {
  const session = await requireActionPermission('CONFIG_MANAGE')

  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    include: {
      rows: {
        where: {
          status: 'PENDING',
          ...(rowIds && rowIds.length > 0 ? { id: { in: rowIds } } : {})
        }
      }
    }
  })

  if (!batch) return { success: false, error: "Lote não encontrado." }
  if (!batch.warehouseId) return { success: false, error: "Almoxarifado de destino não definido no lote." }
  await assertWarehouseAccess(batch.warehouseId, session.userId)
  if (batch.status !== 'STAGING') return { success: false, error: "Lote já processado ou cancelado." }

  const warehouseId = batch.warehouseId

  // Get default location for this warehouse
  let defaultLocation = await db.warehouseLocation.findFirst({
    where: { warehouseId }
  })

  if (!defaultLocation) {
    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
    const baseCode = warehouse ? warehouse.code : "ALM"
    let locCode = `${baseCode}-GERAL`
    const existing = await db.warehouseLocation.findUnique({ where: { code: locCode } })
    if (existing) {
      locCode = `${baseCode}-GERAL-${Date.now().toString().slice(-4)}`
    }

    defaultLocation = await db.warehouseLocation.create({
      data: {
        warehouseId,
        code: locCode,
        name: "Estoque Geral",
        description: "Localização padrão criada automaticamente para importação",
        status: "ACTIVE"
      }
    })
  }

  const locationId = defaultLocation.id

  // Get product categories/units just in case we need to create products
  const [defaultCategory, defaultUnit] = await Promise.all([
    db.productCategory.findFirst(),
    db.productUnit.findFirst()
  ])

  const rowsToProcess = batch.rows
  if (rowsToProcess.length === 0) {
    const remainingPending = await db.importBatchRow.count({
      where: { batchId, status: 'PENDING' }
    })
    if (remainingPending === 0) {
      await db.importBatch.update({
        where: { id: batchId },
        data: { status: 'COMPLETED' }
      })
    }
    return { success: true, processed: 0, rowResults: [], completed: remainingPending === 0 }
  }

  // Pre-fetch existing products for all codes in this chunk (isolado por almoxarifado)
  const productCodes = Array.from(new Set(rowsToProcess.map(r => r.productCode).filter(Boolean)))
  const existingProducts = await db.product.findMany({
    where: {
      code: { in: productCodes },
      OR: [
        { stocks: { some: { warehouseId } } },
        { defaultLocation: { warehouseId } }
      ]
    }
  })
  const productMap = new Map(existingProducts.map(p => [p.code, p]))

  // Create missing products in bulk if needed (exclusivos deste almoxarifado)
  const missingCodes = productCodes.filter(code => !productMap.has(code))
  if (missingCodes.length > 0 && defaultCategory && defaultUnit) {
    const newProductsData = missingCodes.map(code => {
      const row = rowsToProcess.find(r => r.productCode === code)!
      const cost = row.unitCost != null ? Number(row.unitCost) : null
      return {
        code,
        name: row.productName || code,
        categoryId: defaultCategory.id,
        unitId: defaultUnit.id,
        defaultLocationId: locationId,
        averageCost: cost != null && cost > 0 ? cost : null,
      }
    })

    await db.product.createMany({
      data: newProductsData,
    })

    const newlyCreated = await db.product.findMany({
      where: {
        code: { in: missingCodes },
        defaultLocationId: locationId,
      }
    })
    for (const p of newlyCreated) {
      productMap.set(p.code, p)
    }
  }

  let successCount = 0
  let createdCount = 0
  let adjustedCount = 0
  let unchangedCount = 0
  const rowResults: { id: string; status: 'SUCCESS' | 'ERROR'; errorMessage?: string | null }[] = []

  // Process rows with controlled concurrency for fast throughput
  const CONCURRENCY = 10
  for (let i = 0; i < rowsToProcess.length; i += CONCURRENCY) {
    const slice = rowsToProcess.slice(i, i + CONCURRENCY)
    await Promise.all(slice.map(async (row) => {
      try {
        if (!row.productCode || row.productCode === 'N/A') {
          throw new Error("Código do produto ausente.")
        }

        const product = productMap.get(row.productCode)
        if (!product) {
          throw new Error("Não há categoria ou unidade padrão para criar o produto.")
        }

        const rawQty = Number(row.quantity)
        const targetQty = Math.max(0, Math.round(rawQty))
        const unitCost = row.unitCost != null ? Number(row.unitCost) : undefined

        let actionMessage = "Sem alterações (estoque já igual)"

        await db.$transaction(async (tx) => {
          // Busca os registros de estoque deste produto neste almoxarifado
          const warehouseStocks = await tx.stock.findMany({
            where: {
              productId: product.id,
              warehouseId,
            },
            orderBy: { quantity: 'desc' }
          })

          const currentWarehouseQty = warehouseStocks.reduce((sum, s) => sum + Number(s.quantity), 0)
          const diff = targetQty - currentWarehouseQty

          if (diff > 0) {
            // Planilha tem MAIS do que o sistema: adiciona apenas a diferença no saldo (sem gerar histórico de movimentação)
            await tx.stock.upsert({
              where: {
                productId_locationId: {
                  productId: product.id,
                  locationId,
                }
              },
              update: {
                quantity: { increment: diff }
              },
              create: {
                productId: product.id,
                warehouseId,
                locationId,
                quantity: diff,
                reservedQuantity: 0
              }
            })

            if (currentWarehouseQty === 0) {
              createdCount++
              actionMessage = `Novo saldo importado (+${diff})`
            } else {
              adjustedCount++
              actionMessage = `Estoque ajustado: ${currentWarehouseQty} → ${targetQty} (+${diff})`
            }
          } else if (diff < 0) {
            // Planilha tem MENOS do que o sistema: reduz a diferença para igualar à planilha (sem gerar histórico de movimentação)
            let remainingToDeduct = Math.abs(diff)

            // Prioriza deduzir da localização padrão primeiro, depois das demais localizações do almoxarifado
            const sortedStocks = [...warehouseStocks].sort((a, b) => {
              if (a.locationId === locationId) return -1
              if (b.locationId === locationId) return 1
              return b.quantity - a.quantity
            })

            for (const st of sortedStocks) {
              if (remainingToDeduct <= 0) break
              if (st.quantity <= 0) continue

              const deductFromLoc = Math.min(st.quantity, remainingToDeduct)
              remainingToDeduct -= deductFromLoc

              await tx.stock.update({
                where: { id: st.id },
                data: { quantity: { decrement: deductFromLoc } }
              })
            }

            adjustedCount++
            actionMessage = `Estoque ajustado: ${currentWarehouseQty} → ${targetQty} (${diff})`
          } else {
            if (warehouseStocks.length === 0) {
              await tx.stock.upsert({
                where: {
                  productId_locationId: {
                    productId: product.id,
                    locationId,
                  }
                },
                update: {},
                create: {
                  productId: product.id,
                  warehouseId,
                  locationId,
                  quantity: 0,
                  reservedQuantity: 0
                }
              })
              createdCount++
              actionMessage = `Item cadastrado no almoxarifado (saldo 0)`
            } else {
              // Quantidade idêntica no sistema e na planilha: mantém sem criar movimentação duplicada
              unchangedCount++
              actionMessage = `Mantido (${targetQty} em estoque)`
            }
          }

          // Atualiza nome do produto e/ou custo unitário se necessário
          const productUpdates: { name?: string; averageCost?: number; defaultLocationId?: string } = {}
          if (!product.defaultLocationId) {
            productUpdates.defaultLocationId = locationId
          }
          if (row.productName && row.productName !== 'N/A' && row.productName !== product.name) {
            productUpdates.name = row.productName
          }
          if (unitCost != null && unitCost > 0) {
            const currentAvg = product.averageCost != null ? Number(product.averageCost) : null
            if (currentAvg === null || Math.abs(currentAvg - unitCost) > 0.0001) {
              productUpdates.averageCost = unitCost
            }
          }

          if (Object.keys(productUpdates).length > 0) {
            await tx.product.update({
              where: { id: product.id },
              data: productUpdates
            })
            if (productUpdates.name) product.name = productUpdates.name
            if (productUpdates.averageCost !== undefined) product.averageCost = productUpdates.averageCost as any
          }
        })

        rowResults.push({ id: row.id, status: 'SUCCESS', errorMessage: actionMessage })
        successCount++
      } catch (err: any) {
        rowResults.push({
          id: row.id,
          status: 'ERROR',
          errorMessage: err.message || "Erro desconhecido"
        })
      }
    }))
  }

  // Persist status and sync messages for all processed rows
  await Promise.all(
    rowResults.map(item =>
      db.importBatchRow.update({
        where: { id: item.id },
        data: { status: item.status, errorMessage: item.errorMessage }
      })
    )
  )

  // Check if all rows are done
  const remainingPending = await db.importBatchRow.count({
    where: { batchId, status: 'PENDING' }
  })

  if (remainingPending === 0) {
    await db.importBatch.update({
      where: { id: batchId },
      data: { status: 'COMPLETED' }
    })
    await logAudit("IMPORT_EXECUTED", "ImportBatch", batchId, { successCount, remainingPending }, session.userId)
  }

  return {
    success: true,
    processed: successCount,
    rowResults,
    completed: remainingPending === 0
  }
}
