import { describe, it, expect } from "vitest"
import {
  buildInformakonRows, classifyMovement, documentDigits, normalizeSubInsumoCode, formatBrazilDate,
  ENTRADAS_HEADERS, SAIDAS_HEADERS, type ExportMovement,
} from "@/lib/informakon-export"

function mv(overrides: Partial<ExportMovement>): ExportMovement {
  return {
    id: "m1", type: "ENTRY", referenceType: "RECEIPT", referenceId: "r1", documentNumber: "1046",
    quantity: 15, unitCost: 3.5, totalCost: 52.5, reason: null, notes: null,
    createdAt: new Date("2026-11-20T15:00:00Z"), productCode: "001172-002", productName: "Cabo",
    warehouseCode: "CGC.01.0114", warehouseName: "Almoxarifado Central", recipientName: null,
    ...overrides,
  }
}

describe("informakon-export", () => {
  it("normaliza o código do sub-insumo para 000000-000", () => {
    expect(normalizeSubInsumoCode("001172-002")).toBe("001172-002")
    expect(normalizeSubInsumoCode("022137")).toBe("022137-000")
    expect(normalizeSubInsumoCode("022167000")).toBe("022167-000")
    expect(normalizeSubInsumoCode("1172-2")).toBe("001172-002")
    expect(normalizeSubInsumoCode("ABC")).toBeNull()
  })

  it("Nº Documento fica só com números", () => {
    expect(documentDigits("ENT-000198")).toBe("198")
    expect(documentDigits("CAU-000004")).toBe("4")
    expect(documentDigits("NF 15452554")).toBe("15452554")
    expect(documentDigits(null)).toBe("")
  })

  it("usa o fuso de Brasília na data", () => {
    // 01:30 UTC do dia 21 = 22:30 do dia 20 em Brasília
    expect(formatBrazilDate(new Date("2026-11-21T01:30:00Z"))).toBe("20/11/2026")
  })

  it("mapeia os tipos de movimento", () => {
    expect(classifyMovement("ENTRY", "RECEIPT")).toEqual({ kind: "entradas", movType: "C", docType: "NF" })
    expect(classifyMovement("ADJUSTMENT_IN", "INVENTORY_ADJUSTMENT")).toEqual({ kind: "entradas", movType: "I", docType: "AE" })
    expect(classifyMovement("RETURN", "TOOL_LOAN_RETURN")).toEqual({ kind: "entradas", movType: "O", docType: "AE" })
    expect(classifyMovement("EXIT", "QUICK_ISSUE")).toEqual({ kind: "saidas", movType: "S", docType: "RM" })
    expect(classifyMovement("EXIT", "TOOL_LOAN")).toEqual({ kind: "saidas", movType: "S", docType: "RM" })
    expect(classifyMovement("ADJUSTMENT_OUT", null)).toEqual({ kind: "saidas", movType: "I", docType: "IN-INVENTARIO" })
  })

  it("gera linhas de entrada e saída com as colunas exatas dos modelos", () => {
    const { entradas, saidas, issues } = buildInformakonRows([
      mv({}),
      mv({ id: "m2", type: "EXIT", referenceType: "QUICK_ISSUE", documentNumber: "ENT-000198", quantity: -3, unitCost: null, totalCost: null, reason: "Entrega rápida", recipientName: "Raimundo" }),
    ])
    expect(issues).toEqual([])
    expect(Object.keys(entradas[0])).toEqual([...ENTRADAS_HEADERS])
    expect(Object.keys(saidas[0])).toEqual([...SAIDAS_HEADERS])
    expect(entradas[0]).toMatchObject({ "Cód Centro de Negócio": "CGC.01.0114", "Data da Movimentação": "20/11/2026", "Nº Documento": "1046", "Quantidade": 15, "Valor do Item": 52.5 })
    expect(saidas[0]).toMatchObject({ "Cód. Tipo de Movimento": "S", "Tipo Doc.": "RM", "Nº Documento": "198", "Quantidade": 3, "Destinatário": "Raimundo", "Observação": "Entrega rápida" })
  })

  it("entrada sem custo vai com valor 0", () => {
    const { entradas } = buildInformakonRows([mv({ unitCost: null, totalCost: null })])
    expect(entradas[0]["Valor do Item"]).toBe(0)
  })

  it("aponta almoxarifado com código fora do padrão e não gera a linha", () => {
    const { entradas, issues } = buildInformakonRows([mv({ warehouseCode: "ALM-CENTRAL" })])
    expect(entradas).toHaveLength(0)
    expect(issues[0]).toContain("ALM-CENTRAL")
  })
})
