// Parser compartilhado das planilhas "CADASTRO FORNECEDOR" exportadas do Informakon.
// Usado pela tela de importação (/admin/suppliers/import) e por scripts de carga.

export type SupplierSource = "MGA" | "CV"

export type SupplierBatchItem = {
  erpCode: string
  name: string
  tradeName: string | null
  document: string | null
  category: string | null
  phone: string | null
  state: string | null
  status: "ACTIVE" | "INACTIVE"
  registeredAt: string | null // ISO string — "Data Cadastro" do ERP
}

export const SUPPLIER_SOURCES: SupplierSource[] = ["MGA", "CV"]

export function normalizeSupplierSource(value: unknown): SupplierSource | null {
  const v = String(value ?? "").trim().toUpperCase()
  return v === "MGA" || v === "CV" ? v : null
}

// Detecta a empresa pelo nome do arquivo ("CADASTRO FORNECEDOR  MGA.xlsx" etc.)
export function detectSupplierSourceFromFilename(filename: string): SupplierSource | null {
  const upper = filename.toUpperCase()
  if (/\bMGA\b/.test(upper)) return "MGA"
  if (/\bCV\b/.test(upper)) return "CV"
  return null
}

function normalizeKey(key: string) {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

function nullIfEmpty(v: string): string | null {
  const t = v.trim()
  return t === "" || t === "0" || t === "0000" ? null : t
}

// Converte "Data Cadastro" da planilha (serial do Excel, Date ou string) para ISO.
export function excelDateToIso(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString()
  const n = Number(value)
  if (!isNaN(n) && n > 0) {
    // Serial do Excel: dias desde 30/12/1899
    return new Date(Math.round((n - 25569) * 86400 * 1000)).toISOString()
  }
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// Mapeia uma linha crua da planilha para o item normalizado.
// Retorna null quando a linha não tem código nem razão social (linha vazia/cabeçalho).
export function mapSupplierRow(rawRow: Record<string, unknown>): SupplierBatchItem | null {
  const row: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rawRow)) row[normalizeKey(k)] = v

  const erpCode = pick(row, "codigo", "cod", "code")
  let name = pick(row, "razaosocial", "nome", "name")
  if (!erpCode || !name) return null

  // Cadastros inativos no ERP vêm com marcador "*inativo*"/"*inativa*" na razão social
  const inactive = /\*\s*inativ[ao]\s*\*/i.test(name)
  if (inactive) name = name.replace(/\*\s*inativ[ao]\s*\*/i, "").trim()

  return {
    erpCode,
    name,
    tradeName: nullIfEmpty(pick(row, "fantasia", "nomefantasia")),
    document: nullIfEmpty(pick(row, "cnpjcpf", "documento", "document", "cpf", "cnpj")),
    category: nullIfEmpty(pick(row, "especiedecredor", "categoria", "category")),
    phone: nullIfEmpty(pick(row, "telefone", "fone", "phone")),
    state: nullIfEmpty(pick(row, "uf", "estado", "state")),
    status: inactive ? "INACTIVE" : "ACTIVE",
    registeredAt: excelDateToIso(row["datacadastro"]),
  }
}
