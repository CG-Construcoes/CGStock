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
export const BACKUP_TABLE_ORDER = { insert: INSERT_ORDER, delete: DELETE_ORDER }

// Tabelas M-N implícitas do Prisma (ex.: _RoleToUser) — não aparecem no DMMF.
// Dependem dos dois lados: são apagadas primeiro e inseridas por último.
async function listImplicitTables(runner: typeof db | Prisma.TransactionClient = db) {
  const rows = await runner.$queryRawUnsafe<{ table_name: string }[]>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ~ '^_[A-Za-z0-9]+To[A-Za-z0-9]+$'`)
  return rows.map((r) => r.table_name)
}

async function tableColumns(table: string, runner: typeof db | Prisma.TransactionClient = db) {
  const rows = await runner.$queryRawUnsafe<{ column_name: string }[]>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, table)
  return rows.map((r) => r.column_name)
}

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
  const implicitTables: Record<string, unknown[]> = {}
  for (const name of await listImplicitTables()) {
    implicitTables[name] = await db.$queryRawUnsafe<unknown[]>(`SELECT * FROM "${name}"`)
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: "CGStock",
    exportedAt: new Date().toISOString(),
    tables,
    implicitTables,
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
      // M-N implícitas primeiro na exclusão (dependem dos dois lados)
      const implicitNames = await listImplicitTables(tx)
      for (const name of implicitNames) {
        await tx.$executeRawUnsafe(`DELETE FROM "${name}"`)
      }
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
      // M-N implícitas por último na inserção
      const implicit = (p as { implicitTables?: Record<string, Record<string, unknown>[]> }).implicitTables ?? {}
      for (const name of implicitNames) {
        const rows = implicit[name] ?? []
        summary[name] = rows.length
        if (!rows.length) continue
        const cols = await tableColumns(name, tx)
        const colSql = cols.map((c) => `"${c}"`).join(", ")
        const chunkSize = Math.max(1, Math.floor(3000 / cols.length))
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize)
          const values: unknown[] = []
          const placeholders = chunk.map((r) => `(${cols.map((c) => `$${values.push(r[c] ?? null)}`).join(", ")})`).join(", ")
          await tx.$executeRawUnsafe(`INSERT INTO "${name}" (${colSql}) VALUES ${placeholders}`, ...values)
        }
      }
    },
    { maxWait: 30_000, timeout: 300_000 }
  )
  return summary
}
