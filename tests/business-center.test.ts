import { describe, it, expect } from "vitest"
import { isBusinessCenterCode, validateWarehouseForm } from "@/lib/business-center"

describe("código de centro de negócio (Informakon)", () => {
  it("aceita o formato AAA.BB.CCCC", () => {
    expect(isBusinessCenterCode("CGC.01.0114")).toBe(true)
    expect(isBusinessCenterCode("cvp.01.0008")).toBe(true)
    expect(isBusinessCenterCode(" PSC.01.0011 ")).toBe(true)
  })

  it("rejeita códigos fora do padrão", () => {
    for (const code of ["ALM-CENTRAL", "PSC-01-0011", "CGC.1.0114", "CGC.01.114", "CGCX.01.0114", ""]) {
      expect(isBusinessCenterCode(code)).toBe(false)
    }
  })

  it("exige engenheiro responsável com nome e e-mail válidos", () => {
    const base = { name: "Obra", code: "CCJ.01.0001", engineerName: "Fulano", engineerEmail: "fulano@cg.com" }
    expect(validateWarehouseForm(base)).toBeNull()
    expect(validateWarehouseForm({ ...base, code: "ALM-CENTRAL" })).toContain("AAA.BB.CCCC")
    expect(validateWarehouseForm({ ...base, engineerName: "" })).toContain("engenheiro")
    expect(validateWarehouseForm({ ...base, engineerEmail: "fulano" })).toContain("e-mail")
  })
})
