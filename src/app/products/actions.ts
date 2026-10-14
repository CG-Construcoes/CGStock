"use server"

import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { assertWarehouseAccess } from "@/lib/dal"

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
