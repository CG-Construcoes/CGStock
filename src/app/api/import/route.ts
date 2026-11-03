import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getValidatedSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { Prisma } from '@prisma/client'

const MAX_IMPORT_ROWS = 5000

type ParsedRow = {
  code: string
  name: string
  unitCode: string
  quantity: number
  averageCost: number
  minimumStock: number
}

export async function POST(request: Request) {
  const session = await getValidatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }
  if (!session.roles?.includes('ADMIN')) {
    return NextResponse.json({ error: 'Apenas administradores podem importar dados.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { filename, data } = body

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    if (data.length > MAX_IMPORT_ROWS) {
      return NextResponse.json({ error: `A planilha excede o limite de ${MAX_IMPORT_ROWS} linhas.` }, { status: 400 })
    }

    // 1. Validar e normalizar as linhas antes de tocar no banco
    const rows: ParsedRow[] = []
    const skippedRows: number[] = []

    data.forEach((row: Record<string, unknown>, index: number) => {
      const code = String(row['Material'] ?? '').trim()
      const name = String(row['Especificação'] ?? '').trim()
      const unitCode = String(row['Unidade'] ?? 'UN').toUpperCase() || 'UN'
      const quantity = Number(row['Quantidade']) || 0
      const statedCost = Number(row['Pr. Unitário']) || 0
      const totalValue = Number(row['Valor']) || 0
      const averageCost = (quantity > 0 && totalValue > 0) ? (totalValue / quantity) : statedCost
      const minimumStock = Number(row['Estq.Mínimo']) || 0

      if (!code || code === 'undefined' || !name || name === 'undefined') {
        skippedRows.push(index + 1)
        return
      }
      rows.push({ code, name, unitCode, quantity, averageCost, minimumStock })
    })

    if (rows.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0, created: 0, updated: 0, skipped: skippedRows.length })
    }

    const isMahay = filename?.toLowerCase().includes('mahay')
    const warehouseCode = isMahay ? 'MAHAY' : 'ALM-01'
    const warehouseName = isMahay ? 'Almoxarifado Mahay' : 'Almoxarifado Principal'

    const result = await db.$transaction(async (tx) => {
      // 2. Categoria, armazém e localização padrão
      const defaultCategory = await tx.productCategory.upsert({
        where: { name: 'Geral' },
        update: {},
        create: { name: 'Geral', description: 'Categoria padrão de importação' }
      })

      const warehouse = await tx.warehouse.upsert({
        where: { code: warehouseCode },
        update: {},
        create: { code: warehouseCode, name: warehouseName }
      })

      const location = await tx.warehouseLocation.upsert({
        where: { code: 'GERAL' },
        update: {},
        create: { warehouseId: warehouse.id, code: 'GERAL', name: 'Geral' }
      })

      if (location.warehouseId !== warehouse.id) {
        throw new Error("A localização GERAL pertence a outro almoxarifado.")
      }

      // 3. Unidades: pré-carrega e cria as que faltam em lote
      const unitCodes = [...new Set(rows.map(r => r.unitCode))]
      const existingUnits = await tx.productUnit.findMany({ where: { code: { in: unitCodes } } })
      const unitMap = new Map(existingUnits.map(u => [u.code, u.id]))
      const missingUnitCodes = unitCodes.filter(c => !unitMap.has(c))
      if (missingUnitCodes.length > 0) {
        await tx.productUnit.createMany({
          data: missingUnitCodes.map(code => ({ code, name: code })),
          skipDuplicates: true
        })
        const createdUnits = await tx.productUnit.findMany({ where: { code: { in: missingUnitCodes } } })
        createdUnits.forEach(u => unitMap.set(u.code, u.id))
      }

      // 4. Produtos: pré-carrega os existentes neste almoxarifado e separa criação de atualização
      const codes = rows.map(r => r.code)
      const [existingProducts, whLocations] = await Promise.all([
        tx.product.findMany({
          where: {
            code: { in: codes },
            OR: [
              { stocks: { some: { warehouseId: warehouse.id } } },
              { defaultLocation: { warehouseId: warehouse.id } }
            ]
          },
          select: { id: true, code: true, defaultLocationId: true }
        }),
        tx.warehouseLocation.findMany({
          where: { warehouseId: warehouse.id },
          select: { id: true }
        })
      ])
      const whLocationIds = new Set(whLocations.map(l => l.id))
      const productByCode = new Map(existingProducts.map(p => [p.code, p.id]))
      const productDefaultLoc = new Map(
        existingProducts.map(p => [
          p.id,
          p.defaultLocationId && whLocationIds.has(p.defaultLocationId) ? p.defaultLocationId : location.id
        ])
      )

      const toCreate = rows.filter(r => !productByCode.has(r.code))
      const toUpdate = rows.filter(r => productByCode.has(r.code))

      if (toCreate.length > 0) {
        await tx.product.createMany({
          data: toCreate.map(r => ({
            code: r.code,
            name: r.name,
            categoryId: defaultCategory.id,
            unitId: unitMap.get(r.unitCode)!,
            defaultLocationId: location.id,
            minimumStock: r.minimumStock,
            averageCost: r.averageCost,
            status: 'ACTIVE'
          })),
        })
        const createdProducts = await tx.product.findMany({
          where: {
            code: { in: toCreate.map(r => r.code) },
            defaultLocationId: location.id
          },
          select: { id: true, code: true }
        })
        createdProducts.forEach(p => productByCode.set(p.code, p.id))
      }

      for (const r of toUpdate) {
        await tx.product.update({
          where: { id: productByCode.get(r.code)! },
          data: {
            name: r.name,
            unitId: unitMap.get(r.unitCode)!,
            minimumStock: r.minimumStock,
            averageCost: r.averageCost,
          }
        })
      }

      // 5. Estoque: ajusta apenas onde houve diferença (respeitando a localização do produto)
      const productIds = rows.map(r => productByCode.get(r.code)!).filter(Boolean)
      const existingStocks = await tx.stock.findMany({
        where: { productId: { in: productIds }, warehouseId: warehouse.id }
      })
      const stockByProduct = new Map<string, typeof existingStocks[number]>()
      for (const s of existingStocks) {
        const targetLoc = productDefaultLoc.get(s.productId) ?? location.id
        const prev = stockByProduct.get(s.productId)
        if (!prev || s.locationId === targetLoc) {
          stockByProduct.set(s.productId, s)
        }
      }

      const stockCreates: Prisma.StockCreateManyInput[] = []
      const stockUpdates: { id: string, quantity: number }[] = []
      let stockAdjustmentsCount = 0

      for (const r of rows) {
        const productId = productByCode.get(r.code)
        if (!productId) continue

        const targetLocId = productDefaultLoc.get(productId) ?? location.id
        const current = stockByProduct.get(productId)
        const currentQty = current?.quantity || 0
        const difference = Number(r.quantity) - Number(currentQty)

        if (difference === 0) {
          if (!current) {
            stockCreates.push({
              productId,
              warehouseId: warehouse.id,
              locationId: targetLocId,
              quantity: 0
            })
          }
          continue
        }

        if (current) {
          stockUpdates.push({ id: current.id, quantity: r.quantity })
        } else {
          stockCreates.push({
            productId,
            warehouseId: warehouse.id,
            locationId: targetLocId,
            quantity: r.quantity
          })
        }
        stockAdjustmentsCount++
      }

      if (stockCreates.length > 0) {
        await tx.stock.createMany({ data: stockCreates })
      }
      for (const s of stockUpdates) {
        await tx.stock.update({ where: { id: s.id }, data: { quantity: s.quantity } })
      }

      return {
        processed: rows.length,
        created: toCreate.length,
        updated: toUpdate.length,
        stockAdjustments: stockAdjustmentsCount
      }
    }, {
      timeout: 120000
    })

    await logAudit("PRODUCTS_IMPORTED", "Product", warehouseCode, {
      filename,
      ...result,
      skipped: skippedRows.length
    }, session.userId)

    try {
      revalidatePath('/products')
      revalidatePath('/stock')
    } catch {}

    return NextResponse.json({
      success: true,
      processedCount: result.processed,
      created: result.created,
      updated: result.updated,
      stockAdjustments: result.stockAdjustments,
      skipped: skippedRows.length
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Erro interno ao processar a importação.' }, { status: 500 })
  }
}
