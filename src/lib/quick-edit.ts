/** Edição rápida (direto nas listas de Produtos e Estoque). */
export const PRODUCT_QUICK_EDIT_ACTION = "PRODUCT_QUICK_EDIT"
/** referenceType das movimentações geradas ao editar o saldo direto na lista */
export const QUICK_EDIT_REFERENCE = "QUICK_EDIT"

export type ProductQuickField = "unitId" | "categoryId" | "status" | "averageCost" | "minimumStock" | "maximumStock"

export const PRODUCT_FIELD_LABELS: Record<ProductQuickField, string> = {
  unitId: "Unidade",
  categoryId: "Categoria",
  status: "Status",
  averageCost: "Custo médio",
  minimumStock: "Estoque mínimo",
  maximumStock: "Estoque máximo",
}
