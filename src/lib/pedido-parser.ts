/**
 * Parser da planilha de PEDIDO exportada do Informakon.
 *
 * Formato gerado pelo Kiweb/Informakon ao exportar um pedido de compra:
 *   Item | Sol | Sit | Especificação | Insumo-Sub | Ec | Unid | Quantidade |
 *   PrUnit Inicial | % Desc | PrUnit Insumo | % IPI | Total do Item | ...
 *
 * O cabeçalho é localizado dinamicamente (primeiras 15 linhas). A linha de
 * totalização ao final (só "Total do Item" preenchida) é descartada.
 *
 * `Insumo-Sub` é o código do produto no mesmo formato de `Product.code`
 * ("028651-000") — é a chave de amarração com o cadastro do CGStok.
 */

export type PedidoItem = {
  /** código Insumo-Sub do Informakon = Product.code */
  productCode: string
  /** especificação/descrição do insumo */
  productName: string
  quantity: number
  /** preço unitário final do pedido ("PrUnit Insumo"; cai p/ "PrUnit Inicial" se ausente) */
  unitCost: number | null
  unitCode: string | null
  /** valor total da linha (conferência) */
  totalValue: number | null
}

type ColKey = 'item' | 'name' | 'code' | 'unit' | 'quantity' | 'unitCost' | 'unitCostInitial' | 'totalValue'

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
  item: ['item', 'seq', 'sequencia'],
  name: ['especificacao', 'descricao', 'descricao do material', 'especificacao do material'],
  code: ['insumo sub', 'insumosub', 'insumo', 'codigo', 'material'],
  unit: ['unid', 'unidade', 'un'],
  quantity: ['quantidade', 'qtd', 'qtde'],
  unitCost: ['prunit insumo', 'pr unit insumo', 'preco unitario insumo', 'prunit final', 'preco unitario'],
  unitCostInitial: ['prunit inicial', 'pr unit inicial', 'preco inicial'],
  totalValue: ['total do item', 'total item', 'valor total', 'total'],
}

const HEADER_SCAN_LIMIT = 15

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
    // exige código + quantidade para reconhecer a grade de pedido
    if (cols.code !== undefined && cols.quantity !== undefined) return { index: i, cols }
  }
  return null
}

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

const toText = (v: unknown) => String(v ?? '').trim()

/**
 * Converte a grade crua da planilha (`sheet_to_json` com `{ header: 1 }`)
 * nos itens do pedido. Retorna vazio se a planilha não for um pedido.
 */
export function parsePedidoSheet(rows: unknown[][]): PedidoItem[] {
  const header = locateHeader(rows)
  if (!header) return []
  const { index, cols } = header
  const get = (row: unknown[], key: ColKey) => (cols[key] === undefined ? undefined : row[cols[key]!])

  const out: PedidoItem[] = []
  for (let i = index + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const productCode = toText(get(row, 'code'))
    const productName = toText(get(row, 'name'))

    // ignora linhas vazias e o rodapé de totalização (só Total do Item preenchido)
    if (!productCode && !productName) continue

    const quantity = toNumber(get(row, 'quantity')) ?? 0
    const unitCost = toNumber(get(row, 'unitCost')) ?? toNumber(get(row, 'unitCostInitial'))
    const totalValue = toNumber(get(row, 'totalValue'))
    const unitCode = toText(get(row, 'unit')).toUpperCase() || null

    if (quantity <= 0) continue

    out.push({ productCode, productName, quantity, unitCost, unitCode, totalValue })
  }
  return out
}
