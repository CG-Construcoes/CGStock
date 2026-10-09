"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { executeStockTransfer } from "@/lib/stock"
import { requireActionPermission } from "@/lib/action-guard"
import { createWithUniqueNumber } from "@/lib/sequential"

export async function createTransferAction(formData: FormData) {
  const session = await requireActionPermission('STOCK_TRANSFER')

  const sourceLocationId = formData.get("sourceLocationId") as string
  const destinationLocationId = formData.get("destinationLocationId") as string

  if (!sourceLocationId || !destinationLocationId) {
    redirect("/transfers/new?error=Selecione a localização de origem e destino.")
  }

  if (sourceLocationId === destinationLocationId) {
    throw new Error("Localização de origem e destino não podem ser iguais.")
  }

  // Obter os almoxarifados a partir dos locais
  const [sourceLoc, destLoc] = await Promise.all([
    db.warehouseLocation.findUnique({ where: { id: sourceLocationId } }),
    db.warehouseLocation.findUnique({ where: { id: destinationLocationId } })
  ])

  if (!sourceLoc || !destLoc) throw new Error("Localizações inválidas.")

  const trf = await createWithUniqueNumber(
    async (attempt) => {
      const count = await db.stockTransfer.count()
      return `TRF-${new Date().getFullYear()}-${String(count + 1 + attempt).padStart(4, '0')}`
    },
    (transferNumber) => db.stockTransfer.create({
      data: {
        transferNumber,
        sourceWarehouseId: sourceLoc.warehouseId,
        sourceLocationId,
        destinationWarehouseId: destLoc.warehouseId,
        destinationLocationId,
        createdById: session.userId,
        status: 'DRAFT'
      }
    })
  )
  
  const productIds = formData.getAll("productId") as string[]
  const quantities = formData.getAll("quantity") as string[]
  const unitIds = formData.getAll("unitId") as string[]

  if (productIds.length > 0) {
    const items = productIds.map((pid, idx) => ({
      productId: pid,
      quantity: Number(quantities[idx]),
      unitId: unitIds[idx]
    }))

    await executeStockTransfer(trf.id, session.userId, items)
  }

  revalidatePath("/transfers")
  revalidatePath("/dashboard")
  redirect("/transfers")
}
