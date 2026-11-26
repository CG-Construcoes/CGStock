import { Prisma } from "@prisma/client"

/**
 * Busca de produtos tolerante: cada palavra digitada precisa aparecer em algum
 * campo (nome, código, código de barras ou localização onde há estoque), em
 * qualquer ordem. Ex.: "cabo azul 2,5" encontra "CABO DE COBRE ... 2,5mm2 ... AZUL".
 * Acento/maiúsculas já são ignorados pela collation utf8mb4_unicode_ci.
 */
export function searchTerms(q: string | null | undefined): string[] {
  return (q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 8)
}

function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, c => `\\${c}`)}%`
}

/** Condição SQL (MariaDB) sobre o alias `p` da tabela Product. Retorna null sem termos. */
export function productSearchSql(q: string | null | undefined): Prisma.Sql | null {
  const terms = searchTerms(q)
  if (!terms.length) return null
  return Prisma.join(terms.map(term => {
    const like = likePattern(term)
    return Prisma.sql`(p.name LIKE ${like} OR p.code LIKE ${like} OR p.barcode LIKE ${like} OR EXISTS (
      SELECT 1 FROM \`Stock\` sq INNER JOIN \`WarehouseLocation\` lq ON lq.id = sq.\`locationId\`
      WHERE sq.\`productId\` = p.id AND sq.quantity > 0 AND (lq.code LIKE ${like} OR lq.name LIKE ${like})
    ))`
  }), " AND ")
}

/** Equivalente em Prisma (para findMany/count). */
export function productSearchWhere(q: string | null | undefined): Prisma.ProductWhereInput | undefined {
  const terms = searchTerms(q)
  if (!terms.length) return undefined
  return {
    AND: terms.map(term => ({
      OR: [
        { name: { contains: term } },
        { code: { contains: term } },
        { barcode: { contains: term } },
        { stocks: { some: { quantity: { gt: 0 }, location: { OR: [{ code: { contains: term } }, { name: { contains: term } }] } } } },
      ],
    })),
  }
}
