import type { Prisma } from "@prisma/client"
import { PRODUCT_CHANGE_ACTIONS, changesFromMetadata } from "./product-changes"

/** Rótulos amigáveis das ações registradas na trilha de auditoria. */
const ACTION_LABELS: Record<string, string> = {
  BACKUP_EXPORTED: "Backup exportado",
  BACKUP_RESTORED: "Backup restaurado",
  COLLECTION_SUBMITTED_OFFLINE: "Coleta enviada (offline)",
  EMPLOYEE_CREATED: "Funcionário criado",
  EMPLOYEE_STATUS_CHANGED: "Status do funcionário alterado",
  EMPLOYEES_WAREHOUSE_ASSIGNED: "Almoxarifados atribuídos a funcionário",
  EMPLOYEE_UPDATED: "Funcionário atualizado",
  IMPORT_EXECUTED: "Importação executada",
  INVENTORY_CREATED_OFFLINE: "Inventário criado (offline)",
  LOGIN_FAILED: "Falha de login",
  LOGIN_SUCCESS: "Login",
  PASSWORD_RESET_COMPLETED: "Redefinição de senha concluída",
  PASSWORD_RESET_REQUESTED: "Redefinição de senha solicitada",
  PRODUCT_QUICK_EDIT: "Edição rápida de produto",
  PRODUCTS_BULK_DELETED: "Produtos excluídos em massa",
  PRODUCTS_IMPORTED: "Produtos importados",
  PRODUCT_UPDATED: "Produto atualizado",
  PRODUCT_CATEGORY_CHANGED: "Categoria do produto alterada",
  QUICK_ISSUE_CREATED_OFFLINE: "Entrega rápida criada (offline)",
  RECEIPT_CONFIRMED: "Recebimento confirmado",
  RECEIPT_CONFIRMED_OFFLINE: "Recebimento confirmado (offline)",
  RECEIPT_CREATED: "Recebimento criado",
  RECEIPT_CREATED_OFFLINE: "Recebimento criado (offline)",
  REQUEST_APPROVED: "Requisição aprovada",
  REQUEST_CANCELLED: "Requisição cancelada",
  REQUEST_CREATED: "Requisição criada",
  REQUEST_CREATED_OFFLINE: "Requisição criada (offline)",
  REQUEST_FULFILLED: "Requisição atendida",
  REQUEST_FULFILLED_OFFLINE: "Requisição atendida (offline)",
  REQUEST_REJECTED: "Requisição rejeitada",
  REQUEST_SEPARATION_STARTED: "Separação iniciada",
  RETURN_CREATED_OFFLINE: "Devolução criada (offline)",
  STOCK_ADJUSTMENT: "Ajuste de estoque",
  STOCK_ADJUSTMENT_OFFLINE: "Ajuste de estoque (offline)",
  STOCK_QUICK_EDIT: "Edição rápida de saldo",
  TRANSFER_CREATED_OFFLINE: "Transferência criada (offline)",
  USER_IMPORT: "Importação de usuários",
}

export function getAuditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

/**
 * Resumo legível dos detalhes do log: para alterações de produto usa o
 * parser compartilhado (Campo: antes → depois); para o restante devolve o
 * metadata em JSON compacto ou null quando não há nada a exibir.
 */
export function getAuditDetailsText(action: string, metadata: Prisma.JsonValue | null): { productChanges?: { label: string; from: string; to: string }[]; fallback?: string } {
  if (PRODUCT_CHANGE_ACTIONS.includes(action)) {
    const changes = changesFromMetadata(action, metadata)
    if (changes.length) return { productChanges: changes }
  }
  if (metadata == null) return {}
  const json = JSON.stringify(metadata)
  if (json === "{}" || json === "null") return {}
  return { fallback: json }
}
