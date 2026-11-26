/**
 * Lê números digitados no padrão brasileiro.
 *   "11.000"   → 11000   (ponto como separador de milhar)
 *   "11.000,5" → 11000.5
 *   "12,5"     → 12.5
 *   "12.5"     → 12.5    (ponto decimal só quando não forma grupo de milhar)
 * O <input type="number"> do navegador lia "11.000" como 11 — origem do bug
 * nas entradas de cabos com metragem alta.
 */
export function parseDecimalBR(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN
  let s = (raw ?? "").replace(/R\$|\s/g, "")
  if (!s) return NaN
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".")
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "")
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN
  return Number(s)
}

export function formatDecimalBR(value: number, maxFractionDigits = 4): string {
  return Number.isFinite(value) ? value.toLocaleString("pt-BR", { maximumFractionDigits: maxFractionDigits }) : ""
}
