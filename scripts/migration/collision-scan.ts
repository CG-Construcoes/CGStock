// Escaneia o backup JSON procurando linhas que colidiriam em colunas
// únicas sob collation utf8mb4_unicode_ci (acento, caixa, superscript,
// espaço final). Aproxima o folding do UCA: NFKD + strip combining +
// superscripts + casefold + trim.
import { readFileSync } from "node:fs"

const file = process.argv[2] ?? "/tmp/cgstock-export.json"
const data = JSON.parse(readFileSync(file, "utf8"))

const fold = (s: unknown) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[²³¹]/g, (c) => ({ "²": "2", "³": "3", "¹": "1" })[c]!)
    .replace(/[⁴⁵⁶⁷⁸⁹⁰]/g, (c) => String("⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)))
    .replace(/º/g, "o").replace(/ª/g, "a")
    .toLowerCase()
    .trim()
    .replace(/\s+$/, "")

const checks: [string, string[]][] = [
  ["User", ["email"]], ["User", ["employeeCode"]], ["User", ["qrToken"]],
  ["Role", ["name"]], ["Permission", ["key"]],
  ["ProductCategory", ["name"]], ["ProductCategory", ["informakonKey"]],
  ["ProductUnit", ["code"]], ["ProductUnit", ["informakonKey"]],
  ["Product", ["informakonKey"]],
  ["Warehouse", ["code"]], ["Warehouse", ["informakonKey"]],
  ["WarehouseLocation", ["code"]],
  ["Supplier", ["informakonKey"]], ["Supplier", ["source", "erpCode"]],
  ["Worksite", ["code"]], ["Worksite", ["informakonKey"]],
  ["Tenant", ["slug"]],
  ["MaterialRequest", ["requestNumber"]],
  ["Inventory", ["code"]],
  ["MaterialReturn", ["returnNumber"]],
  ["StockTransfer", ["transferNumber"]],
  ["QuickIssue", ["issueNumber"]],
  ["ToolLoan", ["loanNumber"]],
  ["ToolAsset", ["qrToken"]], ["ToolAsset", ["warehouseId", "code"]],
  ["SyncCheckpoint", ["entity"]],
  ["SystemSetting", ["key"]],
  ["Stock", ["productId", "locationId"]],
  ["UserWarehouseAccess", ["userId", "warehouseId"]],
  ["UserWorksiteAccess", ["userId", "worksiteId"]],
]

let found = 0
for (const [model, cols] of checks) {
  const rows = (data.tables?.[model] ?? []) as Record<string, unknown>[]
  const seen = new Map<string, Record<string, unknown>>()
  for (const r of rows) {
    const vals = cols.map((c) => r[c])
    if (vals.some((v) => v === null || v === undefined)) continue
    const key = vals.map(fold).join("")
    const prev = seen.get(key)
    if (prev) {
      found++
      console.log(`${model}.${cols.join("+")}: [${vals}] colide com [${cols.map((c) => prev[c])}]`)
    } else seen.set(key, r)
  }
}
console.log(found === 0 ? "Nenhuma colisão" : `${found} colisão(ões)`)
