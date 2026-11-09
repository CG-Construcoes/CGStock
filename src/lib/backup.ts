import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"

/**
 * Backup completo do CGStock: exporta todas as tabelas em JSON
 * (comprimido em .json.gz na rota de export) e restaura substituindo
 * integralmente o conteúdo atual dentro de uma única transação.
 */

export const BACKUP_FORMAT = "cgstock-backup"
export const BACKUP_VERSION = 1
const INSERT_CHUNK = 1000

type DmmfModel = { name: string; fields: { name: string; type: string; relationName?: string; relationFromFields?: string[] }[] }

const dmmfModels = (Prisma as unknown as { dmmf: { datamodel: { models: DmmfModel[] } } }).dmmf.datamodel.models
const delegateOf = (name: string) => name.charAt(0).toLowerCase() + name.slice(1)

// Dependências por FK (belongsTo): modelo -> modelos que precisam existir antes
const dependencies = new Map<string, Set<string>>()
const selfFkField = new Map<string, string>()
for (const m of dmmfModels) {
  const deps = new Set<string>()
  for (const f of m.fields) {
    if (f.relationName && f.relationFromFields?.length) {
      if (f.type === m.name) selfFkField.set(m.name, f.relationFromFields[0])
      else deps.add(f.type)
    }
  }
  dependencies.set(m.name, deps)
}

// Ordem de inserção: pais antes dos filhos (ordem de exclusão é a inversa)
function buildInsertOrder(): string[] {
  const done = new Set<string>()
  const order: string[] = []
  let progress = true
  while (progress) {
    progress = false
    for (const m of dmmfModels) {
      if (done.has(m.name)) continue
      if ([...(dependencies.get(m.name) ?? [])].every((d) => done.has(d))) {
        done.add(m.name)
        order.push(m.name)
        progress = true
      }
    }
  }
  // Ciclos: o que sobrou vai no fim
  for (const m of dmmfModels) if (!done.has(m.name)) order.push(m.name)
  return order
}
const INSERT_ORDER = buildInsertOrder()
const DELETE_ORDER = [...INSERT_ORDER].reverse()

// Tabelas com FK para si mesmas (ex.: WarehouseLocation.parentId):
// insere pais antes dos filhos
function sortByHierarchy(model: string, rows: Record<string, unknown>[]) {
  const fk = selfFkField.get(model)
  if (!fk) return rows
  const byId = new Map(rows.map((r) => [r.id as string, r]))
  const depth = (r: Record<string, unknown>, seen = new Set<string>()): number => {
    const parentId = r[fk] as string | null
    if (!parentId || !byId.has(parentId) || seen.has(r.id as string)) return 0
    seen.add(r.id as string)
    return 1 + depth(byId.get(parentId)!, seen)
  }
  return [...rows].sort((a, b) => depth(a) - depth(b))
}

export async function buildBackupData() {
  const tables: Record<string, unknown[]> = {}
  for (const name of INSERT_ORDER) {
    tables[name] = await (db as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[delegateOf(name)].findMany()
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: "CGStock",
    exportedAt: new Date().toISOString(),
    tables,
  }
}

/**
 * Restaura o backup: apaga TODAS as tabelas e reinsere o conteúdo do arquivo.
 * Roda numa única transação — qualquer falha desfaz tudo e o banco fica intacto.
 */
export async function restoreBackupData(payload: unknown) {
  const p = payload as { format?: string; version?: number; tables?: Record<string, unknown[]> }
  if (p?.format !== BACKUP_FORMAT || !p.tables || typeof p.tables !== "object") {
    throw new Error("Arquivo inválido: não é um backup do CGStock.")
  }
  if (p.version !== BACKUP_VERSION) {
    throw new Error(`Versão de backup não suportada (${p.version}). Exporte um novo backup.`)
  }

  const summary: Record<string, number> = {}
  await db.$transaction(
    async (tx) => {
      const t = tx as unknown as Record<string, { deleteMany: () => Promise<unknown>; createMany: (a: { data: unknown[] }) => Promise<unknown> }>
      for (const name of DELETE_ORDER) {
        await t[delegateOf(name)].deleteMany()
      }
      for (const name of INSERT_ORDER) {
        const rows = (p.tables![name] as Record<string, unknown>[]) ?? []
        summary[name] = rows.length
        const sorted = sortByHierarchy(name, rows)
        for (let i = 0; i < sorted.length; i += INSERT_CHUNK) {
          await t[delegateOf(name)].createMany({ data: sorted.slice(i, i + INSERT_CHUNK) })
        }
      }
    },
    { maxWait: 30_000, timeout: 300_000 }
  )
  return summary
}
