"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { executeDivergenceAdjustment } from "@/lib/stock"
import { requireActionPermission } from "@/lib/action-guard"

export async function reviewDivergenceAction(divergenceId: string, inventoryId: string, formData: FormData) {
  const session = await requireActionPermission('INVENTORY_REVIEW')

  const notes = formData.get("notes") as string
  
  await db.inventoryDivergence.update({
    where: { id: divergenceId },
    data: {
      status: 'REVIEWED',
      reviewedById: session.userId,
      reviewedAt: new Date(),
      reviewNotes: notes
    }
  })

  revalidatePath(`/inventory/${inventoryId}/divergences/${divergenceId}`)
  revalidatePath(`/inventory/${inventoryId}/divergences`)
}

export async function approveDivergenceAction(divergenceId: string, inventoryId: string, formData: FormData) {
  const session = await requireActionPermission('INVENTORY_APPROVE')

  const notes = formData.get("notes") as string
  
  await db.inventoryDivergence.update({
    where: { id: divergenceId },
    data: {
      status: 'APPROVED',
      approvedById: session.userId,
      approvedAt: new Date(),
      approvalNotes: notes
    }
  })

  // Executar o ajuste imediatamente após a aprovação
  await executeDivergenceAdjustment(divergenceId, session.userId, notes)

  revalidatePath(`/inventory/${inventoryId}/divergences/${divergenceId}`)
  revalidatePath(`/inventory/${inventoryId}/divergences`)
  redirect(`/inventory/${inventoryId}/divergences`)
}

export async function rejectDivergenceAction(divergenceId: string, inventoryId: string, formData: FormData) {
  const session = await requireActionPermission('INVENTORY_APPROVE')

  const reason = formData.get("reason") as string
  if (!reason) throw new Error("Motivo da rejeição é obrigatório.")
  
  await db.inventoryDivergence.update({
    where: { id: divergenceId },
    data: {
      status: 'REJECTED',
      rejectedById: session.userId,
      rejectedAt: new Date(),
      rejectionReason: reason
    }
  })

  revalidatePath(`/inventory/${inventoryId}/divergences/${divergenceId}`)
  revalidatePath(`/inventory/${inventoryId}/divergences`)
  redirect(`/inventory/${inventoryId}/divergences`)
}
