/**
 * Código de Centro de Negócio do Informakon: AAA.BB.CCCC
 * (AAA = Cód. Empresa, BB = Cód. Filial, CCCC = Cód. Centro). Ex.: CGC.01.0114, CVP.01.0008.
 * O código do almoxarifado no CGStock é exatamente esse código.
 */
export const BUSINESS_CENTER_PATTERN = "[A-Za-z0-9]{3}\\.[0-9]{2}\\.[0-9]{4}"
const BUSINESS_CENTER_REGEX = new RegExp(`^${BUSINESS_CENTER_PATTERN}$`)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeBusinessCenterCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase()
}

export function isBusinessCenterCode(code: string | null | undefined): boolean {
  return BUSINESS_CENTER_REGEX.test(normalizeBusinessCenterCode(code))
}

export type WarehouseFormInput = {
  name: string
  code: string
  engineerName: string
  engineerEmail: string
}

export function validateWarehouseForm(input: WarehouseFormInput): string | null {
  if (!input.name) return "Informe o nome do almoxarifado."
  if (!isBusinessCenterCode(input.code)) {
    return "O código deve ser o Centro de Negócio do Informakon no formato AAA.BB.CCCC (ex: CGC.01.0114)."
  }
  if (!input.engineerName) return "Informe o nome do engenheiro responsável."
  if (!EMAIL_REGEX.test(input.engineerEmail)) return "Informe um e-mail válido para o engenheiro responsável."
  return null
}
