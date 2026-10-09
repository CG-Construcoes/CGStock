import { describe, it, expect } from "vitest"
import { validatePasswordStrength } from "@/lib/password-policy"

describe("validatePasswordStrength", () => {
  it("rejeita senhas curtas", () => {
    expect(validatePasswordStrength("abc123")).toContain("10 caracteres")
    expect(validatePasswordStrength("")).toBeTruthy()
  })

  it("exige letras e números", () => {
    expect(validatePasswordStrength("abcdefghij")).toContain("letras e números")
    expect(validatePasswordStrength("1234567891")).toContain("letras e números")
  })

  it("rejeita senhas comuns", () => {
    expect(validatePasswordStrength("senha12345")).toContain("muito comum")
    expect(validatePasswordStrength("ESTOKA1234")).toContain("muito comum")
  })

  it("aceita senhas fortes", () => {
    expect(validatePasswordStrength("Trator2026Amarelo")).toBeNull()
    expect(validatePasswordStrength("a1b2c3d4e5")).toBeNull()
  })
})
