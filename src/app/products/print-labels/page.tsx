import { db } from "@/lib/db"
import { requireAnyPermissionPage } from "@/lib/permissions"
import { PrintLabelsClient } from "./print-labels-client"
import { Prisma } from "@prisma/client"

export const metadata = {
  title: "Imprimir Etiquetas de Produtos - CGStock",
}

export default async function PrintLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{
    ids?: string
    q?: string
    category?: string
    warehouseId?: string
    status?: string
    limit?: string
  }>
}) {
  await requireAnyPermissionPage("PRODUCT_VIEW", "STOCK_VIEW", "STOCK_EXIT", "PRODUCT_CREATE")

  const resolved = await searchParams
  const ids = resolved?.ids ? resolved.ids.split(",").map((s) => s.trim()).filter(Boolean) : []
  const limit = ids.length > 0 ? ids.length : Math.min(parseInt(resolved?.limit || "100", 10), 300)

  const where: Prisma.ProductWhereInput = {}

  if (ids.length > 0) {
    where.id = { in: ids }
  } else {
    if (resolved?.q) {
      where.OR = [
        { name: { contains: resolved.q, mode: "insensitive" } },
        { code: { contains: resolved.q, mode: "insensitive" } },
      ]
    }
    if (resolved?.category) {
      where.categoryId = resolved.category
    }
    if (resolved?.status) {
      where.status = resolved.status
    } else {
      where.status = "ACTIVE"
    }
    if (resolved?.warehouseId && resolved.warehouseId !== "ALL") {
      where.stocks = { some: { warehouseId: resolved.warehouseId } }
    }
  }

  const [productsRaw, totalActive] = await Promise.all([
    db.product.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        barcode: true,
        brand: true,
        model: true,
        averageCost: true,
        status: true,
        category: {
          select: { id: true, name: true },
        },
        unit: {
          select: { id: true, code: true, name: true },
        },
        stocks: {
          select: {
            quantity: true,
            warehouse: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { code: "asc" },
      take: limit,
    }),
    db.product.count({ where }),
  ])

  // Serializa Decimals para number/string para evitar problemas de hidratação no cliente
  const products = productsRaw.map((p) => {
    const totalStock = p.stocks.reduce((acc, s) => acc + Number(s.quantity || 0), 0)
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      barcode: p.barcode,
      brand: p.brand,
      model: p.model,
      averageCost: p.averageCost ? Number(p.averageCost) : null,
      status: p.status,
      categoryName: p.category?.name || "Sem categoria",
      unitCode: p.unit?.code || "UN",
      totalStock,
      warehouses: p.stocks.map((s) => s.warehouse?.name).filter(Boolean) as string[],
    }
  })

  return (
    <PrintLabelsClient
      products={products}
      isFiltered={ids.length > 0}
      totalCount={totalActive}
    />
  )
}
