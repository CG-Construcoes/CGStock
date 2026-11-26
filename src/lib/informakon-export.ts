import { isBusinessCenterCode, normalizeBusinessCenterCode } from "./business-center"

/**
 * Planilhas de importação de estoque do Informakon (Konstroi):
 * ModeloImportacaoEntradas.xls / ModeloImportacaoSaidas.xls.
 * Os cabeçalhos e a ordem das colunas precisam ser idênticos aos modelos.
 */
export const ENTRADAS_HEADERS = [
  "Cód Centro de Negócio", "Data da Movimentação", "Cód. Tipo de Movimento", "Tipo Doc.", "Nº Documento",
  "Cód. Sub-Insumo", "Quantidade", "Valor do Item", "Observação",
] as const

export const SAIDAS_HEADERS = [
  "Cód Centro de Negócio", "Data da Movimentação", "Cód. Tipo de Movimento", "Tipo Doc.", "Nº Documento",
  "Cód. Sub-Insumo", "Quantidade", "Observação", "Destinatário", "Cód. U.C", "Cód. L.P", "Cód. Equipamento",
  "Origem Equip.", "O.S do Equipamento",
] as const

export type InformakonKind = "entradas" | "saidas"
export type InformakonRow = Record<string, string | number | null>

export type ExportMovement = {
  id: string
  type: string
  referenceType: string | null
  referenceId: string | null
  documentNumber: string | null
  quantity: number
  unitCost: number | null
  totalCost: number | null
  reason: string | null
  notes: string | null
  createdAt: Date
  productCode: string
  productName: string
  warehouseCode: string
  warehouseName: string
  recipientName: string | null
}

type Classification = { kind: InformakonKind; movType: string; docType: string }

/** Mapeamento tipo CGStock → (planilha, Cód. Tipo de Movimento, Tipo Doc.) */
export function classifyMovement(type: string, referenceType: string | null): Classification | null {
  const isCorrection = referenceType === "CORRECTION"
  switch (type) {
    case "ENTRY": return { kind: "entradas", movType: "C", docType: "NF" }
    case "ADJUSTMENT_IN": return isCorrection ? { kind: "entradas", movType: "O", docType: "AE" } : { kind: "entradas", movType: "I", docType: "AE" }
    case "RETURN":
    case "TRANSFER_IN": return { kind: "entradas", movType: "O", docType: "AE" }
    case "EXIT": return { kind: "saidas", movType: "S", docType: "RM" }
    case "ADJUSTMENT_OUT": return isCorrection ? { kind: "saidas", movType: "O", docType: "RM" } : { kind: "saidas", movType: "I", docType: "IN-INVENTARIO" }
    case "TRANSFER_OUT": return { kind: "saidas", movType: "O", docType: "RM" }
    default: return null
  }
}

/** Código do sub-insumo no formato 000000-000 (Insumo-SubInsumo). */
export function normalizeSubInsumoCode(raw: string): string | null {
  const code = raw.trim()
  const dashed = code.match(/^(\d{1,6})-(\d{1,3})$/)
  if (dashed) return `${dashed[1].padStart(6, "0")}-${dashed[2].padStart(3, "0")}`
  if (/^\d{1,6}$/.test(code)) return `${code.padStart(6, "0")}-000`
  if (/^\d{9}$/.test(code)) return `${code.slice(0, 6)}-${code.slice(6)}`
  return null
}

/** Nº Documento: apenas números, sem zeros à esquerda, até 20 caracteres. */
export function documentDigits(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  return digits.slice(-20)
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" })

/** Data no fuso de Brasília em DD/MM/AAAA (o servidor pode estar em UTC). */
export function formatBrazilDate(date: Date): string {
  return dateFormatter.format(date)
}

function round(value: number, digits: number) {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

export function buildInformakonRows(
  movements: ExportMovement[],
  fallbackDocs: Map<string, string> = new Map()
): { entradas: InformakonRow[]; saidas: InformakonRow[]; issues: string[] } {
  const entradas: InformakonRow[] = []
  const saidas: InformakonRow[] = []
  const issues = new Set<string>()

  for (const m of movements) {
    const cls = classifyMovement(m.type, m.referenceType)
    if (!cls) continue

    const centro = normalizeBusinessCenterCode(m.warehouseCode)
    if (!isBusinessCenterCode(centro)) {
      issues.add(`Almoxarifado "${m.warehouseName}" com código fora do padrão Informakon (${m.warehouseCode}).`)
      continue
    }
    const subInsumo = normalizeSubInsumoCode(m.productCode)
    if (!subInsumo) {
      issues.add(`Produto "${m.productName}" com código inválido para o Informakon (${m.productCode}).`)
      continue
    }

    const quantity = round(Math.abs(m.quantity), 4)
    if (!quantity) continue
    const doc = documentDigits(m.documentNumber) || fallbackDocs.get(m.id) || formatBrazilDate(m.createdAt).split("/").reverse().join("")
    const observation = [m.reason, m.notes].filter(Boolean).join(" — ").slice(0, 250) || null

    const base = {
      "Cód Centro de Negócio": centro,
      "Data da Movimentação": formatBrazilDate(m.createdAt),
      "Cód. Tipo de Movimento": cls.movType,
      "Tipo Doc.": cls.docType,
      "Nº Documento": doc,
      "Cód. Sub-Insumo": subInsumo,
      "Quantidade": quantity,
    }

    if (cls.kind === "entradas") {
      const total = m.totalCost ?? (m.unitCost != null ? m.unitCost * quantity : 0)
      entradas.push({ ...base, "Valor do Item": round(Math.abs(total), 2), "Observação": observation })
    } else {
      saidas.push({
        ...base,
        "Observação": observation,
        "Destinatário": m.recipientName?.slice(0, 255) || null,
        "Cód. U.C": null,
        "Cód. L.P": null,
        "Cód. Equipamento": null,
        "Origem Equip.": null,
        "O.S do Equipamento": null,
      })
    }
  }

  return { entradas, saidas, issues: [...issues] }
}
