"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { requireSession } from "@/lib/action-guard"
import { hasPermission } from "@/lib/permissions"
import { assertWarehouseAccess, warehouseScopeIds } from "@/lib/dal"
import { createStockMovement } from "@/lib/stock"
import { pushInsumoUpdate } from "@/lib/informakon"
import { PRODUCT_FIELD_LABELS, PRODUCT_QUICK_EDIT_ACTION, QUICK_EDIT_REFERENCE, type ProductQuickField } from "@/lib/quick-edit"

type Result = { error?: string; success?: string }

function revalidateProductViews(productId: string) {
  revalidatePath("/products")
  revalidatePath("/stock")
  revalidatePath("/movements")
  revalidatePath(`/stock/${productId}`)
  revalidatePath(`/products/${productId}`)
}

async function assertProductAccess(productId: string, userId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { defaultLocation: { select: { warehouseId: true } }, stocks: { select: { warehouseId: true } } },
  })
  if (!product) throw new Error("Produto não encontrado.")
  const ids = new Set(product.stocks.map(s => s.warehouseId))
  if (product.defaultLocation) ids.add(product.defaultLocation.warehouseId)
  for (const id of ids) await assertWarehouseAccess(id, userId)
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 6 })

/** Edita um campo de cadastro do produto direto na lista e registra antes/depois. */
export async function updateProductFieldAction(productId: string, field: ProductQuickField, rawValue: string | number): Promise<Result> {
  try {
    const session = await requireSession()
    if (!(await hasPermission("PRODUCT_UPDATE"))) return { error: "Você não tem permissão para editar produtos." }
    await assertProductAccess(productId, session.userId)

    const product = await db.product.findUniqueOrThrow({
      where: { id: productId },
      select: { unitId: true, averageCost: true, status: true, minimumStock: true, maximumStock: true, categoryId: true, informakonKey: true, defaultLocationId: true, unit: { select: { code: true } }, category: { select: { name: true } } },
    })

    let data: Record<string, unknown>
    let from: string
    let to: string
    switch (field) {
      case "unitId": {
        const unit = await db.productUnit.findUnique({ where: { id: String(rawValue) }, select: { id: true, code: true } })
        if (!unit) return { error: "Unidade inválida." }
        if (unit.id === product.unitId) return { success: "Sem alterações." }
        data = { unitId: unit.id }; from = product.unit.code; to = unit.code
        break
      }
      case "categoryId": {
        const category = await db.productCategory.findUnique({ where: { id: String(rawValue) }, select: { id: true, name: true } })
        if (!category) return { error: "Categoria inválida." }
        if (category.id === product.categoryId) return { success: "Sem alterações." }
        data = { categoryId: category.id }; from = product.category.name; to = category.name
        break
      }
      case "status": {
        const status = rawValue === "INACTIVE" ? "INACTIVE" : "ACTIVE"
        if (status === product.status) return { success: "Sem alterações." }
        data = { status }; from = product.status === "ACTIVE" ? "Ativo" : "Inativo"; to = status === "ACTIVE" ? "Ativo" : "Inativo"
        break
      }
      case "averageCost":
      case "minimumStock":
      case "maximumStock": {
        const value = Number(rawValue)
        if (!Number.isFinite(value) || value < 0) return { error: "Informe um valor numérico maior ou igual a zero." }
        const current = Number(product[field] ?? 0)
        if (value === current) return { success: "Sem alterações." }
        if (field === "minimumStock" && product.maximumStock > 0 && value > product.maximumStock) return { error: "O mínimo não pode ser maior que o máximo." }
        if (field === "maximumStock" && value > 0 && value < product.minimumStock) return { error: "O máximo não pode ser menor que o mínimo." }
        data = { [field]: value }
        from = field === "averageCost" ? `R$ ${fmt(current)}` : fmt(current)
        to = field === "averageCost" ? `R$ ${fmt(value)}` : fmt(value)
        break
      }
      default:
        return { error: "Campo não editável." }
    }

    await db.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data })

      // Toda alteração de cadastro também vira movimentação (aparece em
      // /movements e relatórios) com quem fez e o antes/depois no motivo.
      const location = product.defaultLocationId
        ? await tx.warehouseLocation.findUnique({ where: { id: product.defaultLocationId }, select: { id: true, warehouseId: true } })
        : ((await tx.stock.findFirst({ where: { productId }, select: { location: { select: { id: true, warehouseId: true } } }, orderBy: { quantity: "desc" } }))?.location
          ?? await tx.warehouseLocation.findFirst({ select: { id: true, warehouseId: true } }))
      if (location) {
        await tx.stockMovement.create({
          data: {
            productId,
            warehouseId: location.warehouseId,
            locationId: location.id,
            type: "EDIT",
            quantity: 0,
            referenceType: QUICK_EDIT_REFERENCE,
            reason: `${PRODUCT_FIELD_LABELS[field]}: ${from} → ${to}`,
            notes: "Edição rápida na lista",
            performedById: session.userId,
          },
        })
      }
      await logAudit(PRODUCT_QUICK_EDIT_ACTION, "Product", productId, { field, label: PRODUCT_FIELD_LABELS[field], from, to }, session.userId, tx)
    })

    // Mesmo comportamento da tela de edição: unidade vinculada ao ERP é refletida no Informakon
    if (field === "unitId" && product.informakonKey) {
      const erp = await pushInsumoUpdate(productId)
      if (erp.attempted && !erp.ok) console.warn(`[informakon] falha ao atualizar insumo do produto ${productId}: ${erp.erro}`)
    }

    revalidateProductViews(productId)
    return { success: `${PRODUCT_FIELD_LABELS[field]}: ${from} → ${to}` }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao salvar." }
  }
}

export type StockLocationOption = {
  locationId: string
  locationCode: string
  locationName: string
  warehouseName: string
  quantity: number
  reserved: number
}

/** Saldos do produto por localização (somente almoxarifados com acesso operacional) + locais disponíveis. */
export async function getProductStockLocationsAction(productId: string): Promise<{ stocks: StockLocationOption[]; locations: Omit<StockLocationOption, "quantity" | "reserved">[]; error?: string }> {
  try {
    await requireSession()
    const scope = await warehouseScopeIds()
    const warehouseFilter = scope ? { warehouseId: { in: scope } } : {}
    const [stocks, locations] = await Promise.all([
      db.stock.findMany({
        where: { productId, ...warehouseFilter },
        select: { quantity: true, reservedQuantity: true, location: { select: { id: true, code: true, name: true, warehouse: { select: { name: true } } } } },
        orderBy: [{ quantity: "desc" }],
      }),
      db.warehouseLocation.findMany({
        where: { status: "ACTIVE", warehouse: { status: "ACTIVE" }, ...warehouseFilter },
        select: { id: true, code: true, name: true, warehouse: { select: { name: true } } },
        orderBy: [{ warehouse: { name: "asc" } }, { code: "asc" }],
        take: 500,
      }),
    ])
    return {
      stocks: stocks.map(s => ({
        locationId: s.location.id, locationCode: s.location.code, locationName: s.location.name,
        warehouseName: s.location.warehouse.name, quantity: Number(s.quantity), reserved: Number(s.reservedQuantity),
      })),
      locations: locations.map(l => ({ locationId: l.id, locationCode: l.code, locationName: l.name, warehouseName: l.warehouse.name })),
    }
  } catch (error) {
    return { stocks: [], locations: [], error: error instanceof Error ? error.message : "Erro ao carregar saldos." }
  }
}

/** Define o saldo de uma localização direto na lista; gera movimentação "Edição rápida". */
export async function quickSetStockAction(input: { productId: string; locationId: string; newQuantity: number; reason?: string }): Promise<Result> {
  try {
    const session = await requireSession()
    if (!(await hasPermission("STOCK_ADJUST"))) return { error: "Você não tem permissão para ajustar estoque." }
    const target = Math.round(Number(input.newQuantity) * 10000) / 10000
    if (!Number.isFinite(target) || target < 0) return { error: "Informe uma quantidade maior ou igual a zero." }

    const location = await db.warehouseLocation.findUnique({ where: { id: input.locationId }, select: { id: true, code: true, warehouseId: true } })
    if (!location) return { error: "Localização não encontrada." }
    await assertWarehouseAccess(location.warehouseId, session.userId)

    const stock = await db.stock.findUnique({ where: { productId_locationId: { productId: input.productId, locationId: location.id } }, select: { quantity: true, reservedQuantity: true } })
    const current = Number(stock?.quantity ?? 0)
    const delta = Math.round((target - current) * 10000) / 10000
    if (delta === 0) return { success: "Sem alterações." }
    if (target < Number(stock?.reservedQuantity ?? 0)) return { error: `O saldo não pode ficar abaixo do reservado (${fmt(Number(stock?.reservedQuantity))}).` }

    const reason = input.reason?.trim()
    await db.$transaction(async (tx) => {
      const { movement } = await createStockMovement({
        productId: input.productId,
        warehouseId: location.warehouseId,
        locationId: location.id,
        type: delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        quantity: Math.abs(delta),
        referenceType: QUICK_EDIT_REFERENCE,
        reason: `Edição rápida do saldo em ${location.code}: ${fmt(current)} → ${fmt(target)}`,
        notes: reason || "Edição rápida na lista",
        performedById: session.userId,
      }, tx)
      await logAudit("STOCK_QUICK_EDIT", "StockMovement", movement.id, { productId: input.productId, locationId: location.id, from: current, to: target, reason: reason || null }, session.userId, tx)
    })

    revalidateProductViews(input.productId)
    revalidatePath("/movements")
    return { success: `Saldo em ${location.code}: ${fmt(current)} → ${fmt(target)}` }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao ajustar o saldo." }
  }
}
