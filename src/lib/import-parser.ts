/**
 * Parser de planilhas de importação de produtos/estoque.
 *
 * Aceita os dois formatos usados pelo CGStok:
 *  - Relatório de estoque (cabeçalho na 1ª linha): Material, Especificação,
 *    Unidade, Quantidade, Pr. Unitário, Valor, Estq.Mínimo
 *  - Catálogo/lista de materiais (linhas de título antes do cabeçalho):
 *    Código, Tipo, Descrição do Material, Unid., Categoria, Classificação,
 *    Quantidade, Preço Unit. (R$), Valor Total (R$)
 *
 * O cabeçalho é localizado dinamicamente (primeiras 15 linhas), então
 * títulos, subtítulos e linhas em branco iniciais são ignorados.
 * Linhas de totalização ("TOTAL GERAL") ao final são descartadas.
 */

export type ImportRow = {
  productCode: string
  productName: string
  quantity: number
  unitCost: number | null
  unitCode: string | null
  categoryName: string | null
  minimumStock: number | null
}

type ColKey = 'code' | 'name' | 'quantity' | 'unitCost' | 'totalValue' | 'unit' | 'category' | 'minimumStock'

/** normaliza: minúsculas, sem acentos, sem pontuação, espaços únicos */
const norm = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const HEADER_ALIASES: Record<ColKey, string[]> = {
  code: ['material', 'codigo', 'codigo material', 'cod', 'code', 'item', 'cod item'],
  name: [
    'especificacao',
    'especificacao do material',
    'descricao do material',
    'descricao',
    'descricao do produto',
    'nome',
    'name',
    'produto',
    'denominacao',
  ],
  quantity: ['quantidade', 'quantity', 'qtd', 'qtde', 'estoque', 'saldo', 'qtd estoque', 'quantidade em estoque'],
  unitCost: [
    'pr unitario',
    'preco unitario',
    'preco unit r',
    'preco unit',
    'valor unitario',
    'valor unit r',
    'valor unit',
    'custo unitario',
    'custo unit',
    'custo medio',
    'unit cost',
    'unitcost',
    'custo',
  ],
  totalValue: ['valor total r', 'valor total', 'vlr total', 'valor', 'total'],
  unit: ['unidade', 'unid', 'un', 'unit', 'und'],
  category: ['categoria', 'category', 'grupo', 'grupo de insumos', 'grupo insumos'],
  minimumStock: [
    'estq minimo',
    'estqminimo',
    'estoque minimo',
    'estoqueminimo',
    'est minimo',
    'est min',
    'minimo',
    'minimumstock',
    'estoque min',
  ],
}

const HEADER_SCAN_LIMIT = 15

/** encontra a linha de cabeçalho e o índice de cada coluna reconhecida */
function locateHeader(rows: unknown[][]): { index: number; cols: Partial<Record<ColKey, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, HEADER_SCAN_LIMIT); i++) {
    const cols: Partial<Record<ColKey, number>> = {}
    ;(rows[i] ?? []).forEach((cell, j) => {
      const n = norm(cell)
      if (!n) return
      for (const key of Object.keys(HEADER_ALIASES) as ColKey[]) {
        if (cols[key] === undefined && HEADER_ALIASES[key].includes(n)) cols[key] = j
      }
    })
    if (cols.code !== undefined && cols.name !== undefined) return { index: i, cols }
  }
  return null
}

/** número pt-BR ("1.234,56") ou internacional ("1,234.56") ou já numérico */
function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v)
    .trim()
    .replace(/[^\d.,-]/g, '')
  if (!s) return null
  const n =
    s.lastIndexOf(',') > s.lastIndexOf('.')
      ? parseFloat(s.replace(/\./g, '').replace(',', '.'))
      : parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function toText(v: unknown): string {
  const s = String(v ?? '').trim()
  return s === 'undefined' || s === 'null' ? '' : s
}

/**
 * Converte a grade crua da planilha (array de linhas, `sheet_to_json` com
 * `{ header: 1 }`) em linhas de importação normalizadas.
 */
export function parseImportSheet(rows: unknown[][]): ImportRow[] {
  const header = locateHeader(rows)
  if (!header) return []
  const { index, cols } = header
  const get = (row: unknown[], key: ColKey) => (cols[key] === undefined ? undefined : row[cols[key]!])

  const out: ImportRow[] = []
  for (let i = index + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const productCode = toText(get(row, 'code'))
    const productName = toText(get(row, 'name'))
    const nameN = norm(productName)

    // ignora linhas vazias e rodapés de totalização (ex.: "TOTAL GERAL")
    if (!productCode && !productName) continue
    if (!productCode && nameN.startsWith('total')) continue

    const quantity = toNumber(get(row, 'quantity')) ?? 0
    let unitCost = toNumber(get(row, 'unitCost'))
    const totalValue = toNumber(get(row, 'totalValue'))
    if (unitCost == null && totalValue != null && quantity > 0) unitCost = totalValue / quantity

    const unitCode = toText(get(row, 'unit')).toUpperCase() || null
    const categoryName = toText(get(row, 'category')) || null
    const minimumStock = toNumber(get(row, 'minimumStock'))

    out.push({ productCode, productName, quantity, unitCost, unitCode, categoryName, minimumStock })
  }
  return out
}
