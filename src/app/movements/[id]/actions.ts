"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireSession } from "@/lib/action-guard"
import { hasAnyPermission } from "@/lib/permissions"
import { correctMovement, correctionPermissions } from "@/lib/movement-correction"

export async function correctMovementAction(_prev: unknown, formData: FormData): Promise<{ error?: string; success?: string } | null> {
  try {
    const session = await requireSession()
    const movementId = String(formData.get("movementId") || "")
    const newQuantity = Number(String(formData.get("newQuantity") || "").replace(",", "."))
    const reason = String(formData.get("reason") || "")

    const original = await db.stockMovement.findUnique({ where: { id: movementId }, select: { type: true, productId: true } })
    if (!original) return { error: "Movimentação não encontrada." }
    if (!(await hasAnyPermission(...correctionPermissions(original.type)))) {
      return { error: "Você não tem permissão para corrigir este tipo de lançamento." }
    }

    const result = await correctMovement({ movementId, newQuantity, reason, userId: session.userId })

    revalidatePath(`/movements/${movementId}`)
    revalidatePath("/movements")
    revalidatePath("/stock")
    revalidatePath(`/stock/${original.productId}`)
    revalidatePath("/reports", "layout")
    return { success: `Lançamento corrigido de ${result.from.toLocaleString("pt-BR")} para ${result.to.toLocaleString("pt-BR")}.` }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao corrigir o lançamento." }
  }
}
