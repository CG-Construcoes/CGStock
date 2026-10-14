import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import { notFound } from "next/navigation"
import { requirePermissionPage } from "@/lib/permissions"
import { PreviewClient } from "./preview-client"

export const metadata = {
  title: "Preview de Importação | CGStock",
}

export default async function ImportPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage('CONFIG_MANAGE')
  const resolvedParams = await params

  const scope = await warehouseScopeIds()
  const batch = await db.importBatch.findFirst({
    where: { id: resolvedParams.id, warehouseId: { in: scope ?? undefined } },
    include: {
      warehouse: true,
      rows: true,
      createdBy: true
    }
  })

  if (!batch) notFound()

  const productCodes = Array.from(
    new Set(batch.rows.map((r) => r.productCode).filter(Boolean))
  )

  const existingProducts = batch.warehouseId && productCodes.length > 0
    ? await db.product.findMany({
        where: { code: { in: productCodes } },
        select: {
          code: true,
          stocks: {
            where: { warehouseId: batch.warehouseId },
            select: { quantity: true },
          },
        },
      })
    : []

  const stockByCode = new Map<string, number>()
  for (const p of existingProducts) {
    const totalQty = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0)
    stockByCode.set(p.code, totalQty)
  }

  const serializedBatch = {
    ...batch,
    rows: batch.rows.map((row) => {
      const targetQty = Math.max(0, Math.round(Number(row.quantity)))
      const hasProductInSystem = stockByCode.has(row.productCode)
      const currentQty = stockByCode.get(row.productCode) ?? 0
      return {
        ...row,
        quantity: Number(row.quantity),
        targetQty,
        currentQty: hasProductInSystem ? currentQty : null,
        diffQty: targetQty - currentQty,
        isNewProduct: !hasProductInSystem,
        unitCost: row.unitCost !== null ? Number(row.unitCost) : null,
      }
    }),
  }

  return <PreviewClient batch={serializedBatch} />
}
