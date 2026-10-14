import { Suspense } from "react"
import Link from "next/link"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { resolveWarehouseContext } from "@/lib/dal"
import { requireAnyPermissionPage } from "@/lib/permissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BackButton } from "@/components/ui/back-button"
import { SearchInput } from "@/components/ui/search-input"
import { WarehouseSelectFilter } from "@/components/ui/warehouse-select-filter"
import { recalculateAllInventoriesPartialAction } from "@/app/inventory/actions"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowRight,
  Clock,
  Eye,
  X,
  Filter,
} from "lucide-react"

export const metadata = {
  title: "Divergências de Inventário | CGStock",
}

export default async function DivergencesHubPage(props: {
  searchParams?: Promise<{
    q?: string
    status?: string
    warehouseId?: string
    page?: string
  }>
}) {
  await requireAnyPermissionPage(
    "INVENTORY_REVIEW",
    "INVENTORY_APPROVE",
    "INVENTORY_CREATE",
    "INVENTORY_COUNT",
    "STOCK_VIEW"
  )

  const resolvedParams = props?.searchParams ? await props.searchParams : {}
  const q = resolvedParams.q?.trim() || ""
  const statusFilter = resolvedParams.status || ""
  const page = Math.max(1, parseInt(resolvedParams.page || "1", 10))
  const pageSize = 50

  const {
    warehouses,
    selectedWarehouseId,
    warehouseWhere,
  } = await resolveWarehouseContext(resolvedParams.warehouseId)

  const baseInventoryWhere: Prisma.InventoryDivergenceWhereInput = {}
  if (warehouseWhere) {
    baseInventoryWhere.inventory = { warehouseId: warehouseWhere.warehouseId }
  }
  if (q) {
    baseInventoryWhere.OR = [
      { product: { name: { contains: q, mode: "insensitive" } } },
      { product: { code: { contains: q, mode: "insensitive" } } },
      { location: { code: { contains: q, mode: "insensitive" } } },
      { inventory: { name: { contains: q, mode: "insensitive" } } },
      { inventory: { code: { contains: q, mode: "insensitive" } } },
    ]
  }

  // Contagens por status para os cards clicáveis
  const [
    pendingCount,
    reviewedCount,
    approvedCount,
    rejectedCount,
    totalAllCount,
    uncollectedPendingCount,
  ] = await Promise.all([
    db.inventoryDivergence.count({ where: { ...baseInventoryWhere, status: "PENDING" } }),
    db.inventoryDivergence.count({ where: { ...baseInventoryWhere, status: "REVIEWED" } }),
    db.inventoryDivergence.count({ where: { ...baseInventoryWhere, status: { in: ["APPROVED", "ADJUSTED"] } } }),
    db.inventoryDivergence.count({ where: { ...baseInventoryWhere, status: "REJECTED" } }),
    db.inventoryDivergence.count({ where: baseInventoryWhere }),
    db.inventoryDivergence.count({ where: { ...baseInventoryWhere, status: "PENDING", countedQuantity: 0 } }),
  ])

  const filteredWhere: Prisma.InventoryDivergenceWhereInput = { ...baseInventoryWhere }
  if (statusFilter === "APPROVED") {
    filteredWhere.status = { in: ["APPROVED", "ADJUSTED"] }
  } else if (statusFilter) {
    filteredWhere.status = statusFilter
  }

  const [divergences, displayTotal] = await Promise.all([
    db.inventoryDivergence.findMany({
      where: filteredWhere,
      include: {
        product: { include: { unit: true } },
        location: true,
        inventory: { include: { warehouse: true } },
        reviewedBy: true,
        approvedBy: true,
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.inventoryDivergence.count({ where: filteredWhere }),
  ])

  const totalPages = Math.ceil(displayTotal / pageSize)

  const getStatusUrl = (targetStatus: string | null) => {
    const p = new URLSearchParams()
    if (q) p.set("q", q)
    if (selectedWarehouseId) p.set("warehouseId", selectedWarehouseId)
    if (targetStatus && statusFilter !== targetStatus) {
      p.set("status", targetStatus)
    }
    const qs = p.toString()
    return qs ? `/divergences?${qs}` : "/divergences"
  }

  const getPageUrl = (targetPage: number) => {
    const p = new URLSearchParams()
    if (q) p.set("q", q)
    if (selectedWarehouseId) p.set("warehouseId", selectedWarehouseId)
    if (statusFilter) p.set("status", statusFilter)
    p.set("page", String(targetPage))
    return `/divergences?${p.toString()}`
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 text-[10px]">
            <Clock className="h-3 w-3 mr-1" />
            Pendente de Análise
          </Badge>
        )
      case "REVIEWED":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-500/30 bg-blue-500/10 text-[10px]">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Aguardando Aprovação
          </Badge>
        )
      case "APPROVED":
      case "ADJUSTED":
        return (
          <Badge variant="success" className="text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Aprovada / Ajustada
          </Badge>
        )
      case "REJECTED":
        return (
          <Badge variant="destructive" className="text-[10px]">
            <XCircle className="h-3 w-3 mr-1" />
            Rejeitada
          </Badge>
        )
      default:
        return <Badge variant="secondary" className="text-[10px]">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Central de Divergências e Ajustes
            </h2>
            <p className="text-sm text-muted-foreground">
              Analise diferenças entre o saldo do sistema e as contagens físicas de inventário.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {uncollectedPendingCount > 0 && (
            <form action={recalculateAllInventoriesPartialAction}>
              <Button
                type="submit"
                variant="outline"
                className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Manter Apenas Itens Coletados ({uncollectedPendingCount} não bipados)
              </Button>
            </form>
          )}
          <Link href="/inventory">
            <Button variant="outline" className="flex items-center gap-2">
              Ver Inventários
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Filter Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={getStatusUrl("PENDING")} className="block group">
          <Card
            className={cn(
              "rounded-md bg-card shadow-sm transition-all cursor-pointer h-full hover:shadow-md",
              statusFilter === "PENDING"
                ? "border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/[0.04]"
                : "border-border hover:border-amber-500/60"
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">
                Pendentes de Análise
              </CardTitle>
              <div className="bg-amber-500/10 p-2 rounded-lg">
                <FileText className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-foreground">{pendingCount}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">Aguardando revisão</p>
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  {statusFilter === "PENDING" ? "Ativo ✕" : "Filtrar →"}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={getStatusUrl("REVIEWED")} className="block group">
          <Card
            className={cn(
              "rounded-md bg-card shadow-sm transition-all cursor-pointer h-full hover:shadow-md",
              statusFilter === "REVIEWED"
                ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/[0.04]"
                : "border-border hover:border-blue-500/60"
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">
                Ajustes p/ Aprovação
              </CardTitle>
              <div className="bg-blue-500/10 p-2 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-foreground">{reviewedCount}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">Revisadas, prontas p/ ajuste</p>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  {statusFilter === "REVIEWED" ? "Ativo ✕" : "Filtrar →"}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={getStatusUrl("APPROVED")} className="block group">
          <Card
            className={cn(
              "rounded-md bg-card shadow-sm transition-all cursor-pointer h-full hover:shadow-md",
              statusFilter === "APPROVED"
                ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/[0.04]"
                : "border-border hover:border-emerald-500/60"
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">
                Aprovadas / Ajustadas
              </CardTitle>
              <div className="bg-emerald-500/10 p-2 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-foreground">{approvedCount}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">Estoque já regularizado</p>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {statusFilter === "APPROVED" ? "Ativo ✕" : "Filtrar →"}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={getStatusUrl(null)} className="block group">
          <Card
            className={cn(
              "rounded-md bg-card shadow-sm transition-all cursor-pointer h-full hover:shadow-md",
              !statusFilter
                ? "border-primary/60 ring-1 ring-primary/20"
                : "border-border hover:border-primary/50"
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">
                Total Registrado
              </CardTitle>
              <div className="bg-muted p-2 rounded-lg">
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-foreground">{totalAllCount}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">{rejectedCount} rejeitadas</p>
                <span className="text-[10px] font-semibold text-primary">
                  Ver todas →
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Search & Warehouse Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-md border border-border shadow-sm">
        <SearchInput placeholder="Buscar por código, produto, localização ou inventário..." />
        {warehouses.length > 1 && (
          <Suspense fallback={null}>
            <WarehouseSelectFilter
              warehouses={warehouses}
              selectedWarehouseId={selectedWarehouseId}
              className="w-full sm:w-64"
            />
          </Suspense>
        )}
      </div>

      {statusFilter && (
        <div className="flex items-center justify-between p-3 px-4 bg-primary/10 border border-primary/20 rounded-md text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Filtro de status ativo:</span>
            {renderStatusBadge(statusFilter)}
            <span className="text-muted-foreground">({displayTotal} registros)</span>
          </div>
          <Link
            href={getStatusUrl(null)}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <X className="h-3.5 w-3.5" />
            Mostrar todos os status
          </Link>
        </div>
      )}

      {/* Divergences List */}
      <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-border/50">
          {divergences.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto mb-3" />
              Nenhuma divergência encontrada para os filtros selecionados.
            </div>
          ) : (
            divergences.map((div) => {
              const diff = Number(div.difference)
              const isSurplus = diff > 0
              const detailHref = `/inventory/${div.inventoryId}/divergences/${div.id}`

              return (
                <Link
                  key={div.id}
                  href={detailHref}
                  className="block p-4 space-y-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-xs font-mono font-semibold text-muted-foreground">
                        {div.product.code}
                      </span>
                      <h4 className="font-bold text-foreground leading-tight">
                        {div.product.name}
                      </h4>
                    </div>
                    {renderStatusBadge(div.status)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2.5 rounded border border-border/50 text-center">
                    <div>
                      <span className="text-muted-foreground block">Sistema</span>
                      <span className="font-semibold text-sm text-foreground">{Number(div.systemQuantity)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Contado</span>
                      <span className="font-bold text-sm text-foreground">{Number(div.countedQuantity)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Diferença</span>
                      <span className={cn("font-black text-sm", isSurplus ? "text-emerald-600" : "text-red-600")}>
                        {isSurplus ? "+" : ""}{diff}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>
                      {div.inventory.warehouse.name} • Local: <strong className="text-foreground">{div.location.code}</strong>
                    </span>
                    <span className="text-primary font-semibold inline-flex items-center gap-1">
                      Analisar <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              )
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Almoxarifado / Local</TableHead>
                <TableHead>Inventário</TableHead>
                <TableHead className="text-center">Sistema</TableHead>
                <TableHead className="text-center">Contado</TableHead>
                <TableHead className="text-center">Diferença</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divergences.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto mb-3" />
                    Nenhuma divergência encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                divergences.map((div) => {
                  const diff = Number(div.difference)
                  const isSurplus = diff > 0
                  const detailHref = `/inventory/${div.inventoryId}/divergences/${div.id}`

                  return (
                    <TableRow key={div.id} className="group hover:bg-muted/30">
                      <TableCell>
                        <Link href={detailHref} className="block group-hover:text-primary transition-colors">
                          <div className="font-semibold text-foreground group-hover:text-primary">
                            {div.product.name}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">
                            Cód: {div.product.code}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-foreground">
                          {div.location.code}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {div.inventory.warehouse.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/inventory/${div.inventoryId}/divergences`}
                          className="text-xs font-medium text-primary hover:underline block"
                        >
                          {div.inventory.code} - {div.inventory.name}
                        </Link>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(div.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground font-medium">
                        {Number(div.systemQuantity)}
                      </TableCell>
                      <TableCell className="text-center font-bold text-foreground">
                        {Number(div.countedQuantity)}
                      </TableCell>
                      <TableCell className={cn("text-center font-black", isSurplus ? "text-emerald-600" : "text-red-600")}>
                        {isSurplus ? "+" : ""}{diff}
                      </TableCell>
                      <TableCell>
                        {renderStatusBadge(div.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={detailHref}>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 hover:border-primary hover:text-primary">
                            <Eye className="h-3.5 w-3.5" />
                            Analisar
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <div className="text-xs sm:text-sm text-muted-foreground">
              Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({displayTotal} divergências)
            </div>
            <div className="flex items-center gap-2">
              <Link href={page > 1 ? getPageUrl(page - 1) : "#"}>
                <Button variant="outline" size="sm" disabled={page <= 1} className="h-8 text-xs">
                  Anterior
                </Button>
              </Link>
              <Link href={page < totalPages ? getPageUrl(page + 1) : "#"}>
                <Button variant="outline" size="sm" disabled={page >= totalPages} className="h-8 text-xs">
                  Próxima
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
