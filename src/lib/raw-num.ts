import { Prisma } from "@prisma/client"

// $queryRaw no MariaDB devolve COUNT/SUM como BigInt e DECIMAL como
// Prisma.Decimal — BigInt não serializa (JSON/RSC) e quebra aritmética.
export function normalizeNums<R extends Record<string, unknown>>(row: R): R {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? Number(v) : v instanceof Prisma.Decimal ? v.toNumber() : v
  }
  return out as R
}
