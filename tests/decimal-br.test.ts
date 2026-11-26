import { describe, it, expect } from "vitest"
import { parseDecimalBR } from "@/lib/decimal-br"

describe("parseDecimalBR", () => {
  it("lê ponto como separador de milhar (bug das entradas de cabo)", () => {
    expect(parseDecimalBR("11.000")).toBe(11000)
    expect(parseDecimalBR("1.250.000")).toBe(1250000)
    expect(parseDecimalBR("13.000")).toBe(13000)
  })

  it("lê vírgula como decimal", () => {
    expect(parseDecimalBR("12,5")).toBe(12.5)
    expect(parseDecimalBR("11.000,75")).toBe(11000.75)
    expect(parseDecimalBR("R$ 2.000,00")).toBe(2000)
  })

  it("aceita número sem separador e ponto decimal fora do padrão de milhar", () => {
    expect(parseDecimalBR("11000")).toBe(11000)
    expect(parseDecimalBR("12.5")).toBe(12.5)
    expect(parseDecimalBR("0.25")).toBe(0.25)
  })

  it("rejeita texto inválido", () => {
    expect(parseDecimalBR("")).toBeNaN()
    expect(parseDecimalBR("abc")).toBeNaN()
    expect(parseDecimalBR("1,2,3")).toBeNaN()
  })
})
