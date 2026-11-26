import { describe, it, expect } from "vitest"
import { validatePasswordStrength } from "@/lib/password-policy"

describe("validatePasswordStrength", () => {
  it("rejeita senhas com menos de 8 caracteres", () => {
    expect(validatePasswordStrength("ab@1234")).toContain("8 caracteres")
    expect(validatePasswordStrength("")).toBeTruthy()
  })

  it("exige ao menos um número e um caractere especial", () => {
    expect(validatePasswordStrength("abcdefgh")).toContain("caractere especial")
    expect(validatePasswordStrength("abcdefg1")).toContain("caractere especial")
    expect(validatePasswordStrength("abcdefg@")).toContain("número")
  })

  it("não exige letras maiúsculas", () => {
    expect(validatePasswordStrength("trator@26")).toBeNull()
  })

  it("rejeita senhas comuns", () => {
    expect(validatePasswordStrength("senha@123")).toContain("muito comum")
    expect(validatePasswordStrength("ADMIN@123")).toContain("muito comum")
  })

  it("aceita senhas válidas", () => {
    expect(validatePasswordStrength("Trator#2026")).toBeNull()
    expect(validatePasswordStrength("1234567!")).toBeNull()
  })
})
