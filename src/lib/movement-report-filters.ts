import { Prisma } from "@prisma/client"
import { productSearchWhere } from "@/lib/product-search"

/** Filtro "Tipo de movimento" do relatório geral → condição Prisma */
export const KIND_FILTERS: Record<string, { label: string; where: Prisma.StockMovementWhereInput }> = {
  ENTRY: { label: "Entrada", where: { type: "ENTRY" } },
  EXIT: { label: "Saída", where: { type: "EXIT", OR: [{ referenceType: null }, { referenceType: { not: "TOOL_LOAN" } }] } },
  TOOL_LOAN: { label: "Saída — Ferramentaria", where: { type: "EXIT", referenceType: "TOOL_LOAN" } },
  RETURN: { label: "Devolução", where: { type: "RETURN" } },
  ADJUSTMENT_IN: { label: "Ajuste (+)", where: { type: "ADJUSTMENT_IN", OR: [{ referenceType: null }, { referenceType: { notIn: ["CORRECTION", "QUICK_EDIT"] } }] } },
  ADJUSTMENT_OUT: { label: "Ajuste (-)", where: { type: "ADJUSTMENT_OUT", OR: [{ referenceType: null }, { referenceType: { notIn: ["CORRECTION", "QUICK_EDIT"] } }] } },
  CORRECTION: { label: "Correção", where: { referenceType: "CORRECTION" } },
  QUICK_EDIT: { label: "Edição rápida", where: { referenceType: "QUICK_EDIT" } },
  EDIT: { label: "Edição de produto", where: { type: "EDIT" } },
  TRANSFER: { label: "Transferência", where: { type: { in: ["TRANSFER_IN", "TRANSFER_OUT"] } } },
}

export type MovementsReportFilters = {
  typeFilter?: Prisma.StockMovementWhereInput["type"]
  warehouseWhere?: Prisma.StockMovementWhereInput
  q?: string
  categoryId?: string
  kind?: string
  personId?: string
  from?: string
  to?: string
}

const isoDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "")

/** Mesma montagem de WHERE usada pelo template e pelo export — mantém os dois sempre iguais. */
export function buildMovementsReportWhere(f: MovementsReportFilters) {
  const q = f.q?.trim() || ""
  const categoryId = f.categoryId || ""
  const kind = !f.typeFilter && f.kind && KIND_FILTERS[f.kind] ? f.kind : ""
  const personId = f.personId || ""
  const from = isoDate(f.from)
  const to = isoDate(f.to)

  const scopeWhere: Prisma.StockMovementWhereInput = {
    ...(f.typeFilter ? { type: f.typeFilter } : {}),
    ...(f.warehouseWhere ?? {}),
  }
  const productWhere: Prisma.ProductWhereInput = {
    ...(productSearchWhere(q) ?? {}),
    ...(categoryId ? { categoryId } : {}),
  }
  const where: Prisma.StockMovementWhereInput = {
    ...scopeWhere,
    AND: [
      ...(kind ? [KIND_FILTERS[kind].where] : []),
      ...(Object.keys(productWhere).length ? [{ product: productWhere }] : []),
      ...(personId ? [{ OR: [{ performedById: personId }, { recipientUserId: personId }] }] : []),
      ...(from || to ? [{ createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00-03:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999-03:00`) } : {}) } }] : []),
    ],
  }
  return { where, scopeWhere, q, categoryId, kind, personId, from, to }
}
