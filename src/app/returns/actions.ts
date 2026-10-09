"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { receiveMaterialReturn } from "@/lib/stock"
import { requireActionPermission } from "@/lib/action-guard"
import { createWithUniqueNumber } from "@/lib/sequential"

export async function createReturnAction(formData: FormData) {
  const session = await requireActionPermission('STOCK_ENTRY')

  const warehouseId = formData.get("warehouseId") as string
  const reason = formData.get("reason") as string
  const requestId = formData.get("requestId") as string || null

  const ret = await createWithUniqueNumber(
    async (attempt) => {
      const count = await db.materialReturn.count()
      return `RET-${new Date().getFullYear()}-${String(count + 1 + attempt).padStart(4, '0')}`
    },
    (returnNumber) => db.materialReturn.create({
      data: {
        returnNumber,
        warehouseId,
        returnedById: session.userId,
        requestId,
        reason,
        status: 'DRAFT'
      }
    })
  )

  const productIds = formData.getAll("productId") as string[]
  const locationIds = formData.getAll("locationId") as string[]
  const quantities = formData.getAll("quantity") as string[]
  const conditions = formData.getAll("condition") as ('GOOD'|'DAMAGED'|'UNUSABLE')[]
  const unitIds = formData.getAll("unitId") as string[]

  if (productIds.length > 0) {
    const items = productIds.map((pid, idx) => ({
      productId: pid,
      locationId: locationIds[idx],
      quantity: Number(quantities[idx]),
      unitId: unitIds[idx],
      condition: conditions[idx]
    }))

    // Receber e consolidar no estoque
    await receiveMaterialReturn(ret.id, session.userId, items)
  }

  revalidatePath("/returns")
  revalidatePath("/dashboard")
  redirect("/returns")
}
