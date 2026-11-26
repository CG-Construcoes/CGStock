import { db } from "./db"
import { logAuditStrict } from "./audit"
import { createStockMovement, type StockMovementType } from "./stock"
import { getMovementTypeLabel, isInMovement } from "./movement-labels"
import type { PermissionKey } from "./permissions"

/**
 * Correção de lançamentos (entrada, saída, ajuste, devolução).
 *
 * O lançamento original nunca é alterado: a correção gera um novo movimento
 * (ADJUSTMENT_IN/OUT, referenceType CORRECTION, referenceId = original) com a
 * diferença, motivo e autor. Assim o histórico do item, os relatórios de
 * Movimentações, a auditoria e a exportação do Informakon mostram a alteração.
 */
export const CORRECTION_REFERENCE = "CORRECTION"

const CORRECTABLE_TYPES = ["ENTRY", "EXIT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "RETURN"]
// Ferramentaria controla quantidade emprestada/devolvida no próprio empréstimo
const BLOCKED_REFERENCES = ["TOOL_LOAN", "TOOL_LOAN_RETURN", CORRECTION_REFERENCE, "TRANSFER"]

export function correctionBlockReason(type: string, referenceType: string | null): string | null {
  if (referenceType === CORRECTION_REFERENCE) return "Este lançamento já é uma correção. Corrija o lançamento original."
  if (referenceType === "TOOL_LOAN" || referenceType === "TOOL_LOAN_RETURN") return "Empréstimos e devoluções de ferramentas devem ser ajustados pela Ferramentaria."
  if (!CORRECTABLE_TYPES.includes(type) || BLOCKED_REFERENCES.includes(referenceType ?? "")) return "Este tipo de movimentação não pode ser corrigido por aqui."
  return null
}

/** Permissões que autorizam corrigir cada tipo (qualquer uma basta). */
export function correctionPermissions(type: string): PermissionKey[] {
  if (type === "ENTRY" || type === "RETURN") return ["STOCK_ENTRY", "STOCK_ADJUST"]
  if (type === "EXIT") return ["STOCK_EXIT", "STOCK_ADJUST"]
  return ["STOCK_ADJUST"]
}

type CorrectionLike = { type: string; quantity: number }

/** Quantidade vigente do lançamento original considerando as correções já feitas. */
export function effectiveQuantity(original: CorrectionLike, corrections: CorrectionLike[]): number {
  const originalIn = isInMovement(original.type)
  const total = corrections.reduce((sum, c) => {
    const sameDirection = isInMovement(c.type) === originalIn
    return sum + (sameDirection ? Math.abs(c.quantity) : -Math.abs(c.quantity))
  }, Math.abs(original.quantity))
  return Math.round(total * 10000) / 10000
}

/** Tipo do movimento de correção para levar a quantidade vigente até a nova. */
export function correctionType(originalType: string, delta: number): StockMovementType {
  const increasesStock = isInMovement(originalType) ? delta > 0 : delta < 0
  return increasesStock ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT"
}

export async function getMovementCorrections(movementId: string) {
  return db.stockMovement.findMany({
    where: { referenceType: CORRECTION_REFERENCE, referenceId: movementId },
    orderBy: { createdAt: "asc" },
    include: { performedBy: { select: { name: true } } },
  })
}

export async function correctMovement(input: { movementId: string; newQuantity: number; reason: string; userId: string }) {
  const reason = input.reason.trim()
  if (reason.length < 5) throw new Error("Informe o motivo da correção (mínimo 5 caracteres).")
  if (!Number.isFinite(input.newQuantity) || input.newQuantity < 0) throw new Error("Informe uma quantidade válida (zero ou maior).")

  return db.$transaction(async (tx) => {
    const original = await tx.stockMovement.findUnique({ where: { id: input.movementId } })
    if (!original) throw new Error("Movimentação não encontrada.")
    const blocked = correctionBlockReason(original.type, original.referenceType)
    if (blocked) throw new Error(blocked)

    const previous = await tx.stockMovement.findMany({
      where: { referenceType: CORRECTION_REFERENCE, referenceId: original.id },
      select: { type: true, quantity: true },
    })
    const current = effectiveQuantity(original, previous)
    const target = Math.round(input.newQuantity * 10000) / 10000
    const delta = Math.round((target - current) * 10000) / 10000
    if (delta === 0) throw new Error("A quantidade informada é igual à quantidade atual do lançamento.")

    const type = correctionType(original.type, delta)
    const label = getMovementTypeLabel(original.type, original.referenceType)
    const unitCost = type === "ADJUSTMENT_IN" && original.unitCost != null ? Number(original.unitCost) : null

    const { movement } = await createStockMovement({
      productId: original.productId,
      warehouseId: original.warehouseId,
      locationId: original.locationId,
      type,
      quantity: Math.abs(delta),
      unitCost,
      totalCost: unitCost != null ? Math.round(unitCost * Math.abs(delta) * 100) / 100 : null,
      referenceType: CORRECTION_REFERENCE,
      referenceId: original.id,
      documentNumber: original.documentNumber,
      reason: `Correção de ${label.toLowerCase()}${original.documentNumber ? ` ${original.documentNumber}` : ""}: ${current} → ${target}`,
      notes: reason,
      performedById: input.userId,
      recipientUserId: original.recipientUserId,
    }, tx)

    await logAuditStrict("MOVEMENT_CORRECTED", "StockMovement", original.id, {
      correctionId: movement.id, productId: original.productId, from: current, to: target, delta, reason,
    }, input.userId, tx)

    return { correctionId: movement.id, from: current, to: target }
  })
}
