import { describe, expect, it } from "vitest"
import { parseImportSheet } from "@/lib/import-parser"

describe("parseImportSheet", () => {
  it("lê o formato relatório de estoque (cabeçalho na 1ª linha)", () => {
    const rows = [
      ["Material", "Especificação", "Unidade", "Quantidade", "Pr. Unitário", "Valor", "Estq.Mínimo"],
      ["000023-000", "AÇO CA 50 10.0MM", "KG", 12000, 4.88, 58666.44, 500],
      ["000024-000", "AÇO CA 50 12.5MM", "KG", "10.152,89", null, 40577.95, 0],
      ["", "", "", "", "", "", ""],
    ]
    expect(parseImportSheet(rows)).toEqual([
      {
        productCode: "000023-000",
        productName: "AÇO CA 50 10.0MM",
        quantity: 12000,
        unitCost: 4.88,
        unitCode: "KG",
        categoryName: null,
        minimumStock: 500,
      },
      {
        productCode: "000024-000",
        productName: "AÇO CA 50 12.5MM",
        quantity: 10152.89,
        unitCost: expect.closeTo(4.0, 2),
        unitCode: "KG",
        categoryName: null,
        minimumStock: 0,
      },
    ])
  })

  it("lê o formato catálogo/lista de materiais (cabeçalho após títulos)", () => {
    const rows = [
      ["CATÁLOGO E CONTROLO DE MATERIAIS - ELÉTRICA"],
      ["Lista de fios e cabos"],
      [],
      ["Código", "Tipo", "Descrição do Material", "Unid.", "Categoria", "Classificação", "Quantidade", "Preço Unit. (R$)", "Valor Total (R$)"],
      ["023824", "N", "CABO COBRE FLEX EPR 12/20KV 150,0mm2", "M", "Fios e cabos", "Insumo", null, null, null],
      ["022137", "N", "CABO HEPR 0,6/1KV 10,0mm2", "M", "Fios e cabos", "Insumo", 100, "15,40", 1540],
      [null, null, "TOTAL GERAL", null, null, null, null, null, null],
    ]
    expect(parseImportSheet(rows)).toEqual([
      {
        productCode: "023824",
        productName: "CABO COBRE FLEX EPR 12/20KV 150,0mm2",
        quantity: 0,
        unitCost: null,
        unitCode: "M",
        categoryName: "Fios e cabos",
        minimumStock: null,
      },
      {
        productCode: "022137",
        productName: "CABO HEPR 0,6/1KV 10,0mm2",
        quantity: 100,
        unitCost: 15.4,
        unitCode: "M",
        categoryName: "Fios e cabos",
        minimumStock: null,
      },
    ])
  })

  it("retorna vazio quando não encontra cabeçalho reconhecido", () => {
    expect(parseImportSheet([["foo", "bar"], [1, 2]])).toEqual([])
    expect(parseImportSheet([])).toEqual([])
  })

  it("mantém linha sem código desde que tenha nome (revisão marca erro depois)", () => {
    const rows = [["Código", "Descrição do Material"], [null, "ITEM SEM CÓDIGO"]]
    expect(parseImportSheet(rows)).toHaveLength(1)
    expect(parseImportSheet(rows)[0].productCode).toBe("")
  })
})
