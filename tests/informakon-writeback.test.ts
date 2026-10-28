import { describe, it, expect } from "vitest"
import { parseInsKey, parseCcKey, parseUniKey, parseCatKey } from "@/lib/informakon"

describe("parseInsKey (INS:{src}:{insumo}-{sub})", () => {
  it("decodifica chave canônica", () => {
    expect(parseInsKey("INS:MGA:028914-000")).toEqual({ src: "MGA", insumoCod: 28914 })
    expect(parseInsKey("INS:CV:000097-000")).toEqual({ src: "CV", insumoCod: 97 })
  })
  it("rejeita formatos inválidos", () => {
    for (const k of [null, undefined, "", "INS:MGA", "CC:MGA:CGC.01.0104", "INS:MGA:abc-000", "LOCAL-001"])
      expect(parseInsKey(k as string)).toBeNull()
  })
})

describe("parseCcKey (CC:{src}:{emp}.{fil}.{cc})", () => {
  it("decodifica chave canônica", () => {
    expect(parseCcKey("CC:MGA:CGC.01.0104")).toEqual({ src: "MGA", centro: "CGC.01.0104" })
    expect(parseCcKey("CC:CV:PSC.01.0011")).toEqual({ src: "CV", centro: "PSC.01.0011" })
  })
  it("rejeita inválidos", () => {
    for (const k of [null, "", "CC:MGA", "INS:MGA:028914-000", "CC:MGA:CGC0104"])
      expect(parseCcKey(k as string)).toBeNull()
  })
})

describe("parseUniKey", () => {
  it("decodifica", () => {
    expect(parseUniKey("UNI:MGA:SC")).toEqual({ src: "MGA", unid: "SC" })
  })
  it("rejeita", () => {
    expect(parseUniKey("INS:MGA:01")).toBeNull()
    expect(parseUniKey(null)).toBeNull()
  })
})

describe("parseCatKey", () => {
  it("decodifica classe/grupo", () => {
    expect(parseCatKey("CAT:MGA:01.01")).toEqual({ src: "MGA", claIns: "01", gruIns: "01" })
  })
  it("rejeita", () => {
    expect(parseCatKey("CAT:MGA")).toBeNull()
    expect(parseCatKey(null)).toBeNull()
  })
})
