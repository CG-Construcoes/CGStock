import { db } from "@/lib/db"

/**
 * Ponte CGStock → Informakon (write-back via qweb-api /write/*).
 *
 * Regras:
 *  - Só tenta escrever quando o ALMOXARIFADO tem informakonKey (CC:{src}:{emp}.{fil}.{cc})
 *  - Produtos sem informakonKey são pulados do envio (alerta no retorno)
 *  - Falha no ERP NUNCA desfaz a operação local — retorna erro para a UI avisar
 *  - clienteRef = id local → idempotente (reenvio não duplica lançamento no ERP)
 */

const QWEB_API_URL = process.env.QWEB_API_URL ?? "http://localhost:3085"
const QWEB_API_KEY = process.env.QWEB_API_KEY ?? ""
const TIMEOUT_MS = 20_000

export interface ErpPushResult {
  attempted: boolean
  ok?: boolean
  numero?: number
  fonte?: string
  motivo?: string
  erro?: string
  itensOmitidos?: number
}

/** 'INS:MGA:028914-000' → { src:'MGA', insumoCod:28914 } */
export function parseInsKey(key?: string | null): { src: string; insumoCod: number } | null {
  const m = key?.match(/^INS:([A-Za-z0-9_-]+):(\d+)-(\d+)$/)
  return m ? { src: m[1].toUpperCase(), insumoCod: parseInt(m[2], 10) } : null
}

/** 'CC:MGA:CGC.01.0104' → { src:'MGA', centro:'CGC.01.0104' } */
export function parseCcKey(key?: string | null): { src: string; centro: string } | null {
  const m = key?.match(/^CC:([A-Za-z0-9_-]+):([A-Za-z0-9]{1,3}\.[A-Za-z0-9]{1,2}\.[A-Za-z0-9]{1,4})$/)
  return m ? { src: m[1].toUpperCase(), centro: m[2].toUpperCase() } : null
}

/** 'UNI:MGA:SC' → { src:'MGA', unid:'SC' } */
export function parseUniKey(key?: string | null): { src: string; unid: string } | null {
  const m = key?.match(/^UNI:([A-Za-z0-9_-]+):(.+)$/)
  return m ? { src: m[1].toUpperCase(), unid: m[2].trim() } : null
}

/** 'CAT:MGA:01.01' → { src, claIns, gruIns } */
export function parseCatKey(key?: string | null): { src: string; claIns: string; gruIns: string } | null {
  const m = key?.match(/^CAT:([A-Za-z0-9_-]+):([A-Za-z0-9]{1,2})\.([A-Za-z0-9]{1,3})$/)
  return m ? { src: m[1].toUpperCase(), claIns: m[2], gruIns: m[3] } : null
}

async function callWrite<T>(path: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(`${QWEB_API_URL}${path}`, {
    method,
    headers: { "X-Api-Key": QWEB_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
  return res.json() as Promise<T>
}

/**
 * Empurra um movimento (entrada/saída) para o ERP.
 * Itens agrupados por produto; só vão os que têm informakonKey na MESMA fonte do centro.
 */
export async function pushMovimentoAoInformakon(opts: {
  tipo: 'entrada' | 'saida'
  warehouseId: string
  itens: { productId: string; quantidade: number; valor?: number | null }[] // valor = TOTAL da linha (EntradaItem_Valor é total, não unitário)
  docNumero: string
  clienteRef: string
  destinatario?: string
}): Promise<ErpPushResult> {
  try {
    const wh = await db.warehouse.findUnique({
      where: { id: opts.warehouseId },
      select: { informakonKey: true, status: true },
    })
    const cc = parseCcKey(wh?.informakonKey)
    if (!cc) return { attempted: false, motivo: 'almoxarifado local (sem vínculo ERP)' }

    const produtos = await db.product.findMany({
      where: { id: { in: opts.itens.map(i => i.productId) } },
      select: { id: true, informakonKey: true, name: true },
    })
    const ins = new Map(produtos.map(p => [p.id, parseInsKey(p.informakonKey)]))
    const itensErp: { insumoCod: number; quantidade: number; valor?: number | null }[] = []
    let omitidos = 0
    for (const it of opts.itens) {
      const k = ins.get(it.productId)
      if (!k || k.src !== cc.src) { omitidos++; continue }
      itensErp.push({ insumoCod: k.insumoCod, quantidade: it.quantidade, valor: it.valor ?? null })
    }
    if (!itensErp.length)
      return { attempted: false, motivo: 'nenhum item vinculado ao ERP nesta fonte', itensOmitidos: omitidos }

    const r = await callWrite<{ ok?: boolean; numero?: number; fonte?: string; erro?: string; erros?: string[] }>(
      `/write/${opts.tipo}`,
      {
        src: cc.src,
        centro: cc.centro,
        docNumero: opts.docNumero.slice(0, 20),
        clienteRef: opts.clienteRef.slice(0, 60),
        // INFORMAKON_DESTINATARIO=off omite o destinatário no ERP (opção do dia a dia)
        destinatario: process.env.INFORMAKON_DESTINATARIO === 'off' ? undefined : opts.destinatario,
        itens: itensErp,
      },
    )
    if (r?.ok) return { attempted: true, ok: true, numero: r.numero, fonte: r.fonte, itensOmitidos: omitidos }
    return { attempted: true, ok: false, erro: r?.erro ?? 'resposta inesperada da API', itensOmitidos: omitidos }
  } catch (e) {
    return { attempted: true, ok: false, erro: e instanceof Error ? e.message : 'falha na chamada à API' }
  }
}

/** Atualiza especificação/unidade do insumo no ERP (edição de produto). */
export async function pushInsumoUpdate(productId: string): Promise<ErpPushResult> {
  try {
    const p = await db.product.findUnique({
      where: { id: productId },
      select: { name: true, informakonKey: true, unit: { select: { informakonKey: true } } },
    })
    const k = parseInsKey(p?.informakonKey)
    if (!p || !k) return { attempted: false, motivo: 'produto sem vínculo ERP' }
    const uni = parseUniKey(p.unit?.informakonKey)
    const r = await callWrite<{ ok?: boolean; erro?: string }>(
      `/write/insumos/${k.insumoCod}`,
      { src: k.src, especificacao: p.name, ...(uni ? { unid: uni.unid } : {}) },
      'PUT',
    )
    if (r?.ok) return { attempted: true, ok: true, numero: k.insumoCod, fonte: k.src }
    return { attempted: true, ok: false, erro: r?.erro ?? 'resposta inesperada da API' }
  } catch (e) {
    return { attempted: true, ok: false, erro: e instanceof Error ? e.message : 'falha na chamada à API' }
  }
}
