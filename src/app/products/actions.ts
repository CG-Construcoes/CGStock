"use server"

import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { assertWarehouseAccess } from "@/lib/dal"
import { parseCcKey, pushInsumoUpdate } from "@/lib/informakon"

async function assertProductWarehouseAccess(productId: string, userId: string) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { defaultLocation: { select: { warehouseId: true } }, stocks: { select: { warehouseId: true } } } })
  if (!product) throw new Error("Produto não encontrado.")
  const warehouseIds = new Set(product.stocks.map(stock => stock.warehouseId))
  if (product.defaultLocation) warehouseIds.add(product.defaultLocation.warehouseId)
  for (const warehouseId of warehouseIds) await assertWarehouseAccess(warehouseId, userId)
  return Array.from(warehouseIds)
}

export async function createProductAction(formData: FormData) {
  const session = await getSession()
  if (!session) redirect("/login")
  await requirePermission('PRODUCT_CREATE')

  let code = formData.get("code") as string
  const barcode = formData.get("barcode") as string || null
  const name = formData.get("name") as string
  const shortDescription = formData.get("shortDescription") as string || null
  const categoryId = formData.get("categoryId") as string
  const unitId = formData.get("unitId") as string
  const minimumStock = parseInt(formData.get("minimumStock") as string) || 0
  const maximumStock = parseInt(formData.get("maximumStock") as string) || 0
  const brand = formData.get("brand") as string || null
  const model = formData.get("model") as string || null
  const defaultLocationId = formData.get("defaultLocationId") as string || null
  let targetWarehouseId: string | null = null
  if (defaultLocationId) {
    const location = await db.warehouseLocation.findUnique({ where: { id: defaultLocationId } })
    if (!location) throw new Error("Localização inválida.")
    await assertWarehouseAccess(location.warehouseId, session.userId)
    targetWarehouseId = location.warehouseId
  }

  const warehouseCodeFilter = targetWarehouseId
    ? {
        OR: [
          { stocks: { some: { warehouseId: targetWarehouseId } } },
          { defaultLocation: { warehouseId: targetWarehouseId } }
        ]
      }
    : {}

  if (!code && categoryId) {
    const category = await db.productCategory.findUnique({ where: { id: categoryId } })
    if (category) {
      const prefix = category.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z]/g, "")
        .substring(0, 3)
        .toUpperCase()
        .padEnd(3, 'X')
      
      const count = await db.product.count({ where: { categoryId, ...warehouseCodeFilter } })
      
      let isUnique = false
      let attempts = count + 1
      while (!isUnique) {
        code = `${prefix}-${String(attempts).padStart(3, '0')}`
        const existingCode = await db.product.findFirst({ where: { code, ...warehouseCodeFilter } })
        if (!existingCode) {
          isUnique = true
        } else {
          attempts++
        }
      }
    }
  }

  if (!code || !name || !categoryId || !unitId) {
    redirect("/products/new?error=missing_fields")
  }

  // Verifica duplicação de código dentro do mesmo almoxarifado
  const existing = await db.product.findFirst({ where: { code, ...warehouseCodeFilter } })
  if (existing) {
    redirect("/products/new?error=duplicate_code")
  }

  try {
    const created = await db.product.create({
      data: {
        code,
        barcode,
        name,
        shortDescription,
        categoryId,
        unitId,
        minimumStock,
        maximumStock,
        brand,
        model,
        defaultLocationId: defaultLocationId || null
      }
    })
    if (defaultLocationId && targetWarehouseId && "stock" in db && db.stock?.upsert) {
      await db.stock.upsert({
        where: {
          productId_locationId: {
            productId: created.id,
            locationId: defaultLocationId,
          }
        },
        update: {},
        create: {
          productId: created.id,
          warehouseId: targetWarehouseId,
          locationId: defaultLocationId,
          quantity: 0,
          reservedQuantity: 0,
        }
      })
    }
  } catch (error) {
    console.error(error)
    redirect("/products/new?error=create_failed")
  }

  redirect("/products")
}

export type QuickProductResult =
  | { success: true; alreadyExisted: boolean; product: { id: string; code: string; name: string; averageCost: number } }
  | { success: false; error: string }

/**
 * Cadastro rápido a partir da importação de pedido/lista de materiais.
 * Não redireciona: retorna o produto criado para a tela vincular o item.
 * Quando o código traz o sub-insumo explícito (ex.: "023824-000") e o
 * almoxarifado destino é vinculado ao Informakon (CC:<SRC>:...), grava o
 * informakonKey correspondente — o próximo sync atualiza este produto em
 * vez de projetar uma duplicata "<cod>-<SRC>".
 */
export async function quickCreateProductAction(input: {
  code: string
  name: string
  shortDescription?: string | null
  barcode?: string | null
  categoryId: string
  unitId: string
  minimumStock?: number
  maximumStock?: number
  brand?: string | null
  model?: string | null
  defaultLocationId?: string | null
  /** almoxarifado destino da entrada — usado p/ acesso e vínculo INS:<SRC>: */
  warehouseId?: string | null
}): Promise<QuickProductResult> {
  const session = await getSession()
  if (!session) return { success: false, error: "Sessão expirada. Entre novamente." }
  try {
    await requirePermission('PRODUCT_CREATE')
  } catch {
    return { success: false, error: "Você não tem permissão para cadastrar produtos." }
  }

  const code = input.code.trim()
  const name = input.name.trim()
  if (!code || !name || !input.categoryId || !input.unitId) {
    return { success: false, error: "Preencha código, descrição, categoria e unidade." }
  }

  const [category, unit] = await Promise.all([
    db.productCategory.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
    db.productUnit.findUnique({ where: { id: input.unitId }, select: { id: true } }),
  ])
  if (!category || !unit) return { success: false, error: "Categoria ou unidade inválida." }

  const pick = { id: true, code: true, name: true, averageCost: true } as const
  const toDto = (p: { id: string; code: string; name: string; averageCost: unknown }) =>
    ({ id: p.id, code: p.code, name: p.name, averageCost: Number(p.averageCost ?? 0) })

  // Já cadastrado com esse código → só vincula o item
  const byCode = await db.product.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
    select: pick,
  })
  if (byCode) return { success: true, alreadyExisted: true, product: toDto(byCode) }

  let targetWarehouseId: string | null = null
  let defaultLocationId: string | null = null
  try {
    if (input.defaultLocationId) {
      const location = await db.warehouseLocation.findUnique({ where: { id: input.defaultLocationId } })
      if (!location) return { success: false, error: "Localização inválida." }
      await assertWarehouseAccess(location.warehouseId, session.userId)
      targetWarehouseId = location.warehouseId
      defaultLocationId = input.defaultLocationId
    } else if (input.warehouseId) {
      await assertWarehouseAccess(input.warehouseId, session.userId)
      targetWarehouseId = input.warehouseId
    }
  } catch {
    return { success: false, error: "Sem acesso ao almoxarifado selecionado." }
  }

  // Vínculo ERP: só com sub-insumo explícito ("028651-000") — nunca inventa
  // o sufixo, para não roubar o informakonKey de outro insumo.
  let informakonKey: string | null = null
  if (targetWarehouseId && /^\d+-\d+$/.test(code)) {
    const wh = await db.warehouse.findUnique({ where: { id: targetWarehouseId }, select: { informakonKey: true } })
    const cc = parseCcKey(wh?.informakonKey)
    if (cc) {
      const ik = `INS:${cc.src}:${code}`
      const ikOwner = await db.product.findFirst({ where: { informakonKey: ik }, select: pick })
      if (ikOwner) return { success: true, alreadyExisted: true, product: toDto(ikOwner) }
      informakonKey = ik
    }
  }

  try {
    const created = await db.product.create({
      data: {
        code,
        barcode: input.barcode || null,
        name,
        shortDescription: input.shortDescription || null,
        categoryId: input.categoryId,
        unitId: input.unitId,
        minimumStock: input.minimumStock || 0,
        maximumStock: input.maximumStock || 0,
        brand: input.brand || null,
        model: input.model || null,
        defaultLocationId,
        informakonKey,
      },
      select: pick,
    })
    if (defaultLocationId && targetWarehouseId && "stock" in db && db.stock?.upsert) {
      await db.stock.upsert({
        where: { productId_locationId: { productId: created.id, locationId: defaultLocationId } },
        update: {},
        create: {
          productId: created.id,
          warehouseId: targetWarehouseId,
          locationId: defaultLocationId,
          quantity: 0,
          reservedQuantity: 0,
        },
      })
    }
    revalidatePath("/products")
    return { success: true, alreadyExisted: false, product: toDto(created) }
  } catch (error) {
    console.error("Error quick-creating product:", error)
    return { success: false, error: "Falha ao salvar o produto. Tente novamente." }
  }
}

export async function updateProductAction(formData: FormData) {
  const session = await getSession()
  if (!session) redirect("/login")
  await requirePermission('PRODUCT_UPDATE')

  const id = formData.get("id") as string
  const warehouseIds = await assertProductWarehouseAccess(id, session.userId)
  const code = formData.get("code") as string
  const barcode = formData.get("barcode") as string || null
  const name = formData.get("name") as string
  const shortDescription = formData.get("shortDescription") as string || null
  const categoryId = formData.get("categoryId") as string
  const unitId = formData.get("unitId") as string
  const minimumStock = parseInt(formData.get("minimumStock") as string) || 0
  const maximumStock = parseInt(formData.get("maximumStock") as string) || 0
  const brand = formData.get("brand") as string || null
  const model = formData.get("model") as string || null
  const defaultLocationId = formData.get("defaultLocationId") as string || null
  if (defaultLocationId) {
    const location = await db.warehouseLocation.findUnique({ where: { id: defaultLocationId } })
    if (!location) throw new Error("Localização inválida.")
    await assertWarehouseAccess(location.warehouseId, session.userId)
  }
  const status = (formData.get("status") as string) || "ACTIVE"

  if (!id || !code || !name || !categoryId || !unitId) {
    redirect(`/products/${id}/edit?error=missing_fields`)
  }

  // Verifica duplicação de código apenas dentro do mesmo almoxarifado
  const existing = "findFirst" in db.product && typeof db.product.findFirst === "function"
    ? await db.product.findFirst({
        where: {
          code,
          id: { not: id },
          ...(warehouseIds.length > 0
            ? {
                OR: [
                  { stocks: { some: { warehouseId: { in: warehouseIds } } } },
                  { defaultLocation: { warehouseId: { in: warehouseIds } } }
                ]
              }
            : {})
        }
      })
    : null
  if (existing && existing.id !== id) {
    redirect(`/products/${id}/edit?error=duplicate_code`)
  }

  try {
    await db.product.update({
      where: { id },
      data: {
        code,
        barcode,
        name,
        shortDescription,
        categoryId,
        unitId,
        minimumStock,
        maximumStock,
        brand,
        model,
        defaultLocationId: defaultLocationId || null,
        status
      }
    })
  } catch (error) {
    console.error(error)
    redirect(`/products/${id}/edit?error=update_failed`)
  }

  // Write-back: produto vinculado ao ERP → atualiza especificação/unidade no Informakon
  const prod = await db.product.findUnique({ where: { id }, select: { informakonKey: true } })
  if (prod?.informakonKey) {
    const erp = await pushInsumoUpdate(id)
    if (erp.attempted && !erp.ok) console.warn(`[informakon] falha ao atualizar insumo do produto ${id}: ${erp.erro}`)
  }

  redirect("/products")
}

export async function deleteProduct(id: string) {
  const session = await getSession()
  if (!session) throw new Error("Unauthorized")
  await requirePermission('PRODUCT_DELETE')
  await assertProductWarehouseAccess(id, session.userId)

  try {
    await db.product.delete({
      where: { id }
    })
  } catch (error) {
    console.error("Error deleting product:", error)
    throw new Error("Failed to delete product")
  }
}

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/action-guard"
import { logAudit } from "@/lib/audit"

export async function deleteAllProducts() {
  const session = await requireAdmin()

  try {
    await db.$transaction(async (tx) => {
      // Apaga os movimentos primeiro devido as restrições
      await tx.stockMovement.deleteMany()
      await tx.stock.deleteMany()
      await tx.product.deleteMany()
    })
    await logAudit("PRODUCTS_BULK_DELETED", "Product", "ALL", undefined, session.userId)
    revalidatePath('/products')
  } catch (error) {
    console.error("Error deleting all products:", error)
    throw new Error("Falha ao excluir todos os produtos.")
  }
}
