import Link from "next/link"
import { History } from "lucide-react"
import type { Prisma } from "@prisma/client"
import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import { BackButton } from "@/components/ui/back-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { productSearchWhere } from "@/lib/product-search"
import { PRODUCT_CHANGE_ACTIONS, changesFromMetadata } from "@/lib/product-changes"
import { PRODUCT_QUICK_EDIT_ACTION } from "@/lib/quick-edit"
import { ReportExportButtons } from "@/app/reports/components/report-export-buttons"
import { exportProductChangesData } from "@/app/export/actions"

const inputClass = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
const isoDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "")

export default async function ProductChangesReportPage(props: {
  searchParams: Promise<{ page?: string; q?: string; userId?: string; from?: string; to?: string; productId?: string }>
}) {
  await requirePermissionPage("REPORT_VIEW")
  const session = await getValidatedSession()
  const params = await props.searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = 50
  const q = params.q?.trim() || ""
  const userId = params.userId || ""
  const productId = params.productId || ""
  const from = isoDate(params.from)
  const to = isoDate(params.to)

  // Usuários com acesso restrito só veem produtos dos seus almoxarifados
  const scope = await warehouseScopeIds(session!.userId)
  const productWhere: Prisma.ProductWhereInput = {
    ...(productSearchWhere(q) ?? {}),
    ...(scope ? { stocks: { some: { warehouseId: { in: scope } } } } : {}),
  }
  const restrictProducts = !!(q || scope)
  const productIds = productId
    ? [productId]
    : restrictProducts ? (await db.product.findMany({ where: productWhere, select: { id: true } })).map(p => p.id) : null

  const where: Prisma.AuditLogWhereInput = {
    entityType: "Product",
    action: { in: PRODUCT_CHANGE_ACTIONS },
    ...(productIds ? { entityId: { in: productIds } } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to ? { timestamp: { ...(from ? { gte: new Date(`${from}T00:00:00-03:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999-03:00`) } : {}) } } : {}),
  }

  const [logs, total, editors] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { timestamp: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { user: { select: { name: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where: { entityType: "Product", action: { in: PRODUCT_CHANGE_ACTIONS } }, distinct: ["userId"], select: { user: { select: { id: true, name: true } } } }),
  ])
  const products = await db.product.findMany({ where: { id: { in: [...new Set(logs.map(l => l.entityId))] } }, select: { id: true, code: true, name: true } })
  const productById = new Map(products.map(p => [p.id, p]))
  const totalPages = Math.ceil(total / pageSize)
  const hasFilters = !!(q || userId || from || to || productId)
  const pageHref = (target: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ q, userId, from, to, productId })) if (v) sp.set(k, v)
    sp.set("page", String(target))
    return `/reports/changes?${sp.toString()}`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><History className="h-6 w-6 text-emerald-600" /> Alterações de Cadastro</h1>
            <p className="text-muted-foreground text-sm mt-1">Edições de unidade, categoria, custo, status, mínimo/máximo e demais dados dos produtos — com antes, depois, quem e quando.</p>
          </div>
        </div>
        <ReportExportButtons
          title="ALTERAÇÕES DE CADASTRO"
          filename={`CGSTOCK_Alteracoes_Cadastro${from ? `_${from}` : ''}${to ? `_a_${to}` : ''}`}
          period={from || to ? `${from ? from.split('-').reverse().join('/') : 'início'} até ${to ? to.split('-').reverse().join('/') : 'hoje'}` : undefined}
          loadData={exportProductChangesData.bind(null, { q, userId, productId, from, to })}
        />
      </div>

      <form method="get" action="/reports/changes" className="bg-card rounded-md border border-border shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        {productId && <input type="hidden" name="productId" value={productId} />}
        <label className="space-y-1 lg:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto / código</span>
          <input name="q" defaultValue={q} placeholder="Nome ou código" className={inputClass} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Usuário</span>
          <select name="userId" defaultValue={userId} className={inputClass}>
            <option value="">Todos</option>
            {editors.map(e => <option key={e.user.id} value={e.user.id}>{e.user.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2 lg:col-span-2">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">De</span>
            <input type="date" name="from" defaultValue={from} className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Até</span>
            <input type="date" name="to" defaultValue={to} className={inputClass} />
          </label>
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5 justify-end">
          {hasFilters && <a href="/reports/changes" className="inline-flex items-center h-9 px-4 rounded-md border border-border text-sm hover:bg-muted">Limpar</a>}
          <button type="submit" className="inline-flex items-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Filtrar</button>
        </div>
      </form>

      <p className="text-sm text-muted-foreground -mt-2">
        {total.toLocaleString("pt-BR")} alteração(ões). Edições de <strong>saldo</strong> ficam em <Link href="/reports/movements?kind=QUICK_EDIT" className="text-primary hover:underline">Movimentações → Edição rápida de saldo</Link>.
      </p>

      <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{hasFilters ? "Nenhuma alteração com esses filtros." : "Nenhuma alteração registrada."}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Alteração</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => {
                  const product = productById.get(log.entityId)
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{log.timestamp.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {product ? <Link href={`/stock/${product.id}`} className="hover:underline">{product.code} - {product.name}</Link> : <span className="text-muted-foreground">Produto removido</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {changesFromMetadata(log.action, log.metadata).map((c, i) => (
                          <div key={i}>
                            <span className="font-medium">{c.label}:</span>{" "}
                            <span className="text-muted-foreground line-through decoration-muted-foreground/50">{c.from}</span>{" → "}
                            <span className="font-semibold">{c.to}</span>
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.user.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{log.action === PRODUCT_QUICK_EDIT_ACTION ? "Edição rápida" : "Tela de edição"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <a href={pageHref(Math.max(1, page - 1))} className={`px-4 py-2 border rounded-md ${page === 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}>Anterior</a>
          <span className="px-4 py-2 text-muted-foreground">Página {page} de {totalPages}</span>
          <a href={pageHref(Math.min(totalPages, page + 1))} className={`px-4 py-2 border rounded-md ${page === totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}>Próxima</a>
        </div>
      )}
    </div>
  )
}
