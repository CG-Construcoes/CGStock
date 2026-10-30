/**
 * Rótulos e sinal de exibição dos tipos de movimentação de estoque.
 *
 * Contexto: registros históricos guardam a quantidade de saídas com sinais
 * diferentes (negativa em quem passa por createStockMovement e positiva na
 * Entrega Rápida e na importação antiga). Por isso a exibição sempre deriva
 * o sinal do TIPO e usa o valor absoluto da quantidade.
 */

export const STOCK_IN_TYPES = ["ENTRY", "ADJUSTMENT_IN", "TRANSFER_IN", "RETURN"] as const
export const STOCK_OUT_TYPES = ["EXIT", "ADJUSTMENT_OUT", "TRANSFER_OUT"] as const
export const ADJUSTMENT_TYPES = ["ADJUSTMENT_IN", "ADJUSTMENT_OUT"] as const

export function isInMovement(type: string): boolean {
  return (STOCK_IN_TYPES as readonly string[]).includes(type)
}

export function isManualAdjustment(referenceType: string | null | undefined): boolean {
  return referenceType === "MANUAL_ADJUSTMENT"
}

export function getMovementTypeLabel(type: string, referenceType?: string | null): string {
  const manual = isManualAdjustment(referenceType)
  if (referenceType === "TOOL_LOAN") return "Saída — Cautela"
  if (referenceType === "TOOL_LOAN_RETURN") return "Devolução — Cautela"
  switch (type) {
    case "ENTRY": return "Entrada"
    case "EXIT": return "Saída"
    case "RETURN": return "Devolução"
    case "ADJUSTMENT_IN": return manual ? "Entrada — Ajuste manual" : "Ajuste (+)"
    case "ADJUSTMENT_OUT": return manual ? "Saída — Ajuste manual" : "Ajuste (-)"
    case "TRANSFER_IN": return "Transf. (+)"
    case "TRANSFER_OUT": return "Transf. (-)"
    default: return type
  }
}

export function getMovementBadgeVariant(type: string, manual = false): "success" | "destructive" | "secondary" | "outline" | "default" {
  switch (type) {
    case "ENTRY": return "success"
    case "EXIT": return "destructive"
    case "RETURN": return "default"
    case "ADJUSTMENT_IN":
    case "ADJUSTMENT_OUT": return manual ? "secondary" : "outline"
    case "TRANSFER_IN":
    case "TRANSFER_OUT": return "secondary"
    default: return "secondary"
  }
}

/** Quantidade para exibição: sempre positiva, o sinal vem do tipo. */
export function displayQuantity(quantity: number): number {
  return Math.abs(quantity)
}

/** Sinal (+/-) de exibição derivado do tipo do movimento. */
export function quantitySign(type: string): "+" | "-" {
  return isInMovement(type) ? "+" : "-"
}
