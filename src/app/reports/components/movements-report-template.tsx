import { db } from "@/lib/db"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { format } from "date-fns"
import { BackButton } from "@/components/ui/back-button"
import { WarehouseSelectFilter } from "@/components/ui/warehouse-select-filter"
import { resolveWarehouseContext } from "@/lib/dal"
import { getValidatedSession } from "@/lib/auth"
import { getMovementTypeLabel, getMovementBadgeVariant, isManualAdjustment, isInMovement } from "@/lib/movement-labels"
import { Prisma } from "@prisma/client"
import { Suspense } from "react"
import Link from "next/link"
import { KIND_FILTERS, buildMovementsReportWhere } from "@/lib/movement-report-filters"
import { ReportExportButtons } from "@/app/reports/components/report-export-buttons"
import { exportFilteredMovementsData } from "@/app/export/actions"

const filterInputClass = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"

export type ReportSearchParams = {
  page?: string
  warehouseId?: string
  q?: string
  categoryId?: string
  kind?: string
  personId?: string
  from?: string
  to?: string
}

export interface MovementsReportTemplateProps {
  title: string;
  description: string;
  icon: React.ElementType;
  typeFilter?: Prisma.StockMovementWhereInput["type"];
  basePath: string;
  searchParams: ReportSearchParams;
}

const isoDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "")

export async function MovementsReportTemplate({
  title,
  description,
  icon: Icon,
  typeFilter,
  basePath,
  searchParams,
}: MovementsReportTemplateProps) {
  const pageSize = 50
  const page = Math.max(1, Number(searchParams.page) || 1)

  const session = await getValidatedSession()
  if (!session) return null
  const { warehouses, selectedWarehouseId, warehouseWhere: wFilter } = await resolveWarehouseContext(searchParams.warehouseId, session.userId)

  const { where: whereClause, scopeWhere, q, categoryId, kind, personId, from, to } = buildMovementsReportWhere({
    typeFilter,
    warehouseWhere: wFilter ?? undefined,
    q: searchParams.q,
    categoryId: searchParams.categoryId,
    kind: searchParams.kind,
    personId: searchParams.personId,
    from: searchParams.from,
    to: searchParams.to,
  })

  // Opções dos filtros: categorias e somente pessoas que aparecem em movimentações do escopo
  const [categories, performers, recipients] = await Promise.all([
    db.productCategory.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.stockMovement.findMany({ where: scopeWhere, distinct: ["performedById"], select: { performedBy: { select: { id: true, name: true } } } }),
    db.stockMovement.findMany({ where: { ...scopeWhere, recipientUserId: { not: null } }, distinct: ["recipientUserId"], select: { recipientUser: { select: { id: true, name: true } } } }),
  ])
  const people = [...new Map([...performers.map(m => m.performedBy), ...recipients.map(m => m.recipientUser!)].map(u => [u.id, u])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  const hasFilters = !!(q || categoryId || kind || personId || from || to)
  const pageHref = (target: number) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries({ warehouseId: searchParams.warehouseId, q, categoryId, kind, personId, from, to })) if (v) params.set(k, v)
    params.set("page", String(target))
    return `${basePath}?${params.toString()}`
  }

  const movements = await db.stockMovement.findMany({
    where: whereClause,
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: { createdAt: 'desc' },
    include: {
      product: { include: { unit: true } },
      warehouse: true,
      location: true,
      performedBy: true
    }
  })

  const total = await db.stockMovement.count({ where: whereClause })
  const correctedIds = movements.length
    ? new Set((await db.stockMovement.findMany({
        where: { referenceType: "CORRECTION", referenceId: { in: movements.map(m => m.id) } },
        select: { referenceId: true },
      })).map(m => m.referenceId))
    : new Set<string | null>()
  const totalPages = Math.ceil(total / pageSize)

  const getTypeLabel = (type: string, referenceType?: string | null): { label: string; color: BadgeProps["variant"] } => {
    return {
      label: getMovementTypeLabel(type, referenceType),
      color: getMovementBadgeVariant(type, isManualAdjustment(referenceType)),
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Icon className="h-6 w-6 text-emerald-600" />
              {title}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{description}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {warehouses.length > 1 && (
            <Suspense fallback={null}>
              <WarehouseSelectFilter
                warehouses={warehouses}
                selectedWarehouseId={selectedWarehouseId}
                className="w-full sm:w-64"
              />
            </Suspense>
          )}
          <ReportExportButtons
            title={title}
            filename={`CGSTOCK_${title.replace(/\s+/g, '_')}${from ? `_${from}` : ''}${to ? `_a_${to}` : ''}`}
            period={from || to ? `${from ? from.split('-').reverse().join('/') : 'início'} até ${to ? to.split('-').reverse().join('/') : 'hoje'}` : undefined}
            loadData={exportFilteredMovementsData.bind(null, {
              typeFilter,
              warehouseId: searchParams.warehouseId,
              q,
              categoryId,
              kind,
              personId,
              from,
              to,
            })}
          />
        </div>
      </div>

      <form method="get" action={basePath} className="bg-card rounded-md border border-border shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        {searchParams.warehouseId && <input type="hidden" name="warehouseId" value={searchParams.warehouseId} />}
        <label className="space-y-1 lg:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto / código</span>
          <input name="q" defaultValue={q} placeholder="Nome, código ou localização" className={filterInputClass} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria</span>
          <select name="categoryId" defaultValue={categoryId} className={filterInputClass}>
            <option value="">Todas</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {!typeFilter && (
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</span>
            <select name="kind" defaultValue={kind} className={filterInputClass}>
              <option value="">Todos</option>
              {Object.entries(KIND_FILTERS).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
            </select>
          </label>
        )}
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Usuário / destinatário</span>
          <select name="personId" defaultValue={personId} className={filterInputClass}>
            <option value="">Todos</option>
            {people.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">De</span>
            <input type="date" name="from" defaultValue={from} className={filterInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Até</span>
            <input type="date" name="to" defaultValue={to} className={filterInputClass} />
          </label>
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6 justify-end">
          {hasFilters && (
            <a href={searchParams.warehouseId ? `${basePath}?warehouseId=${searchParams.warehouseId}` : basePath} className="inline-flex items-center h-9 px-4 rounded-md border border-border text-sm hover:bg-muted">Limpar</a>
          )}
          <button type="submit" className="inline-flex items-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Filtrar</button>
        </div>
      </form>

      <p className="text-sm text-muted-foreground -mt-2">{total.toLocaleString("pt-BR")} movimentação(ões){hasFilters ? " com os filtros aplicados" : ""}.</p>

      <div className="bg-card  rounded-md border border-border shadow-sm  overflow-hidden  ">
        {movements.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {hasFilters ? "Nenhuma movimentação encontrada com esses filtros." : "Nenhuma movimentação registrada."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Origem/Destino</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((mov) => {
                  const t = getTypeLabel(mov.type, mov.referenceType)
                  const isPositive = isInMovement(mov.type)

                  return (
                    <TableRow key={mov.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(mov.createdAt, "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.color} className="text-[10px] uppercase">
                          {t.label}
                        </Badge>
                        {correctedIds.has(mov.id) && (
                          <Link href={`/movements/${mov.id}#corrigir`} className="ml-1.5 text-[10px] font-semibold uppercase text-amber-600 hover:underline">corrigido</Link>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {mov.product.code} - {mov.product.name}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${mov.type === "EDIT" ? 'text-muted-foreground font-normal' : isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {mov.type === "EDIT" ? "—" : `${isPositive ? '+' : '-'}${Math.abs(Number(mov.quantity))}`}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{mov.warehouse.name}</TableCell>
                      <TableCell className="text-xs font-mono bg-muted">{mov.location.code}</TableCell>
                      <TableCell className="text-xs">
                        <Link href={`/movements/${mov.id}`} className="text-primary hover:underline">
                          {mov.documentNumber || 'Detalhes'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{mov.performedBy.name.split(' ')[0]}</TableCell>
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
          <a href={pageHref(Math.max(1, page - 1))} className={`px-4 py-2 border rounded-md ${page === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}>
            Anterior
          </a>
          <span className="px-4 py-2 text-muted-foreground">Página {page} de {totalPages}</span>
          <a href={pageHref(Math.min(totalPages, page + 1))} className={`px-4 py-2 border rounded-md ${page === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}>
            Próxima
          </a>
        </div>
      )}
    </div>
  )
}
