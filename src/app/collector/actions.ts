"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireActionPermission } from "@/lib/action-guard"
import { warehouseIdFilter } from "@/lib/dal"

export async function submitCollectionAction(formData: FormData) {
  const session = await requireActionPermission('INVENTORY_COUNT')

  const inventoryId = formData.get("inventoryId") as string
  const locationId = formData.get("locationId") as string
  
  const itemKeys = Array.from(formData.keys()).filter(k => k.startsWith('qty_'))
  
  const items = itemKeys.map(k => {
    const productId = k.replace('qty_', '')
    const quantity = Number(formData.get(k))
    return { productId, quantity }
  }).filter(i => i.quantity > 0)

  if (items.length === 0) {
    throw new Error("Nenhum item coletado.")
  }

  // O operador precisa estar escalado no inventário e o inventário deve estar aberto
  const inventory = await db.inventory.findUnique({
    where: { id: inventoryId, ...await warehouseIdFilter(session.userId) },
    include: {
      operators: { where: { userId: session.userId } },
      locations: { where: { locationId } }
    }
  })

  if (!inventory) throw new Error("Inventário não encontrado.")
  if (!['IN_PROGRESS', 'COUNTING'].includes(inventory.status)) {
    throw new Error("Este inventário não está aberto para coleta.")
  }
  if (inventory.operators.length === 0 && !session.roles?.includes('ADMIN')) {
    throw new Error("Você não está escalado como operador deste inventário.")
  }
  if (inventory.locations.length === 0) {
    throw new Error("Esta localização não faz parte do inventário.")
  }

  await db.$transaction(async (tx) => {
    // Cria a Coleta
    await tx.inventoryCollection.create({
      data: {
        inventoryId,
        locationId,
        operatorId: session.userId,
        status: 'SUBMITTED',
        startedAt: new Date(),
        finishedAt: new Date(),
        items: {
          create: items
        }
      }
    })

    // Marca o local como COMPLETED no inventário
    await tx.inventoryLocation.update({
      where: {
        inventoryId_locationId: { inventoryId, locationId }
      },
      data: {
        status: 'COMPLETED',
        finishedAt: new Date()
      }
    })
  })

  revalidatePath(`/collector`)
  revalidatePath(`/inventory/${inventoryId}`)
  redirect(`/collector`)
}
