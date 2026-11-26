import type { Prisma } from "@prisma/client"
import { db } from "./db"
import { PRODUCT_QUICK_EDIT_ACTION } from "./quick-edit"

/** Ações de auditoria que representam alteração de cadastro de produto. */
export const PRODUCT_CHANGE_ACTIONS = [PRODUCT_QUICK_EDIT_ACTION, "PRODUCT_UPDATED", "PRODUCT_CATEGORY_CHANGED"]

export type ProductChange = { label: string; from: string; to: string }

/** Normaliza os formatos de metadata (edição rápida, tela de edição, troca de categoria antiga). */
export function changesFromMetadata(action: string, metadata: Prisma.JsonValue): ProductChange[] {
  const m = (metadata ?? {}) as Record<string, unknown>
  if (Array.isArray(m.changes)) return m.changes as ProductChange[]
  if (typeof m.label === "string") return [{ label: m.label, from: String(m.from ?? ""), to: String(m.to ?? "") }]
  if (action === "PRODUCT_CATEGORY_CHANGED") return [{ label: "Categoria", from: "—", to: String(m.categoryName ?? "") }]
  return []
}

export async function getProductChangeHistory(productId: string, take = 10) {
  const logs = await db.auditLog.findMany({
    where: { entityType: "Product", entityId: productId, action: { in: PRODUCT_CHANGE_ACTIONS } },
    orderBy: { timestamp: "desc" },
    take,
    include: { user: { select: { name: true } } },
  })
  return logs.map(l => ({ id: l.id, timestamp: l.timestamp, userName: l.user.name, quick: l.action === PRODUCT_QUICK_EDIT_ACTION, changes: changesFromMetadata(l.action, l.metadata) }))
}
