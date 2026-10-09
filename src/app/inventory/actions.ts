"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { consolidateInventory } from "@/lib/stock"
import { requireActionPermission } from "@/lib/action-guard"
import { createWithUniqueNumber } from "@/lib/sequential"

export async function createInventoryAction(formData: FormData) {
  const session = await requireActionPermission('INVENTORY_CREATE')

  const name = formData.get("name") as string
  const warehouseId = formData.get("warehouseId") as string
  
  const locationKeys = Array.from(formData.keys()).filter(k => k.startsWith('loc_') && formData.get(k) === 'on')
  const operatorKeys = Array.from(formData.keys()).filter(k => k.startsWith('op_') && formData.get(k) === 'on')

  const locationIds = locationKeys.map(k => k.replace('loc_', ''))
  const operatorIds = operatorKeys.map(k => k.replace('op_', ''))

  if (locationIds.length === 0) throw new Error("Selecione pelo menos um local para contagem.")
  if (operatorIds.length === 0) throw new Error("Selecione pelo menos um operador.")

  const currentYear = new Date().getFullYear()
  const codePrefix = `INV-${currentYear}-`

  const inv = await createWithUniqueNumber(
    async (attempt) => {
      const lastInventory = await db.inventory.findFirst({
        where: { code: { startsWith: codePrefix } },
        orderBy: { createdAt: 'desc' },
        select: { code: true }
      })

      let nextNumber = 1
      if (lastInventory) {
        const lastNumber = parseInt(lastInventory.code.split('-')[2], 10)
        if (!isNaN(lastNumber)) nextNumber = lastNumber + 1
      }
      return `${codePrefix}${String(nextNumber + attempt).padStart(3, '0')}`
    },
    (code) => db.inventory.create({
      data: {
        code,
        name,
        warehouseId,
        createdById: session.userId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        locations: {
          create: locationIds.map(locId => ({
            locationId: locId,
            status: 'PENDING'
          }))
        },
        operators: {
          create: operatorIds.map(opId => ({
            userId: opId
          }))
        }
      }
    })
  )

  revalidatePath("/inventory")
  redirect(`/inventory/${inv.id}`)
}

export async function finishInventoryAction(inventoryId: string) {
  const session = await requireActionPermission('INVENTORY_REVIEW')
  await consolidateInventory(inventoryId, session.userId)
  revalidatePath(`/inventory/${inventoryId}`)
  revalidatePath("/inventory")
}

export async function deleteInventoryAction(formData: FormData) {
  await requireActionPermission('INVENTORY_CREATE')

  const inventoryId = formData.get("id") as string
  const inv = await db.inventory.findUnique({ where: { id: inventoryId }, select: { status: true } })
  if (!inv) throw new Error("Inventário não encontrado.")
  if (inv.status === 'COMPLETED') {
    throw new Error("Inventários concluídos não podem ser excluídos.")
  }

  await db.inventory.delete({ where: { id: inventoryId } })
  revalidatePath("/inventory")
  redirect("/inventory")
}

export async function concludeInventoryAction(formData: FormData) {
  await requireActionPermission('INVENTORY_APPROVE')

  const inventoryId = formData.get("id") as string
  await db.inventory.update({
    where: { id: inventoryId },
    data: { status: 'COMPLETED' }
  })
  
  revalidatePath(`/inventory/${inventoryId}`)
  revalidatePath(`/inventory/${inventoryId}/divergences`)
  revalidatePath("/inventory")
  redirect(`/inventory/${inventoryId}`)
}
