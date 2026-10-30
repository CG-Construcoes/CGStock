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
  /** coluna "Categoria" de relatórios de lista de materiais (pré-seleção no cadastro) */
  categoryName: string | null
}

type ColKey = 'item' | 'name' | 'code' | 'unit' | 'quantity' | 'unitCost' | 'unitCostInitial' | 'totalValue' | 'category'

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
  name: ['especificacao', 'descricao', 'descricao do material', 'especificacao do material', 'descricao do insumo', 'especificacao do insumo', 'nome do material'],
  code: ['insumo sub', 'insumosub', 'insumo', 'codigo', 'codigo do insumo', 'cod insumo', 'codigo insumo', 'material'],
  unit: ['unid', 'unidade', 'un'],
  quantity: ['quantidade', 'qtd', 'qtde', 'qtd prevista'],
  unitCost: ['prunit insumo', 'pr unit insumo', 'preco unitario insumo', 'prunit final', 'preco unitario', 'preco unit', 'valor unitario', 'vlr unitario'],
  unitCostInitial: ['prunit inicial', 'pr unit inicial', 'preco inicial'],
  totalValue: ['total do item', 'total item', 'valor total', 'vlr total', 'total'],
  category: ['categoria', 'grupo', 'classe'],
}

const HEADER_SCAN_LIMIT = 60

function aliasMatch(normalizedCell: string, alias: string) {
  return normalizedCell === alias || normalizedCell.startsWith(`${alias} `)
}

function locateHeader(rows: unknown[][]): { index: number; cols: Partial<Record<ColKey, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, HEADER_SCAN_LIMIT); i++) {
    const cols: Partial<Record<ColKey, number>> = {}
    ;(rows[i] ?? []).forEach((cell, j) => {
      const n = norm(cell)
      if (!n) return
      for (const key of Object.keys(HEADER_ALIASES) as ColKey[]) {
        if (cols[key] === undefined && HEADER_ALIASES[key].some((a) => aliasMatch(n, a))) cols[key] = j
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

    // sem código não há como vincular/cadastrar — descarta vazias e o
    // rodapé de totalização ("TOTAL GERAL" / só Total do Item preenchido)
    if (!productCode) continue
    if (/^total\b/i.test(productCode) || /^total\b/i.test(productName)) continue

    // quantidade pode vir vazia (listas de materiais) — entra como 0 para
    // preenchimento manual na tela de entrada
    const quantity = Math.max(0, toNumber(get(row, 'quantity')) ?? 0)
    const unitCost = toNumber(get(row, 'unitCost')) ?? toNumber(get(row, 'unitCostInitial'))
    const totalValue = toNumber(get(row, 'totalValue'))
    const unitCode = toText(get(row, 'unit')).toUpperCase() || null
    const categoryName = toText(get(row, 'category')) || null

    out.push({ productCode, productName, quantity, unitCost, unitCode, totalValue, categoryName })
  }
  return out
}

// ---------- casamento do código Insumo-Sub com o catálogo CGStok ----------

const STOP = new Set(['de', 'da', 'do', 'para', 'com', 'em', 'e', 'a', 'o', 'p', 'x'])

function tokens(v: string): Set<string> {
  return new Set(
    norm(v)
      .split(' ')
      .filter(t => t.length > 1 && !STOP.has(t)),
  )
}

/**
 * Similaridade 0..1 entre a especificação do pedido e o nome do produto —
 * proporção de palavras significativas da especificação presentes no nome.
 * Resolve a ambiguidade multi-fonte: "000209-000" é um produto no MGA e
 * outro no CV; a especificação do pedido aponta o correto.
 */
export function scoreNameMatch(pedidoSpec: string, productName: string): number {
  const want = tokens(pedidoSpec)
  if (want.size === 0) return 0
  const have = tokens(productName)
  let hit = 0
  for (const t of want) if (have.has(t)) hit++
  return hit / want.size
}

export type PedidoProductCandidate = { id: string; code: string; name: string }

/**
 * Escolhe o produto para um item do pedido considerando os sufixos de fonte
 * (`-MGA`, `-CV`): coleta todos os candidatos com mesmo código natural e
 * devolve o de maior similaridade de nome, se passar no limiar.
 */
export function resolvePedidoProduct(
  item: PedidoItem,
  products: PedidoProductCandidate[],
  minScore = 0.4,
): PedidoProductCandidate | null {
  const nat = item.productCode.trim().toUpperCase()
  const exact = products.filter(p => {
    const c = p.code.trim().toUpperCase()
    return c === nat || c === `${nat}-MGA` || c === `${nat}-CV`
  })
  if (exact.length === 1) return exact[0]

  // Código sem sufixo de sub-insumo ("023824"): aceita prefixo ("023824-000",
  // "023824-000-CV"), mas exige confirmação pelo nome para não vincular errado.
  const candidates = exact.length > 0
    ? exact
    : products.filter(p => p.code.trim().toUpperCase().startsWith(`${nat}-`))

  if (candidates.length === 0) return null
  let best: PedidoProductCandidate | null = null
  let bestScore = 0
  for (const c of candidates) {
    const s = scoreNameMatch(item.productName, c.name)
    if (s > bestScore) { bestScore = s; best = c }
  }
  return bestScore >= minScore ? best : null
}
