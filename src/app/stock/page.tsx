import { Suspense } from "react"
import { Search, Box, Loader2, DollarSign, Boxes, PackageCheck, AlertTriangle, X } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { resolveWarehouseContext } from "@/lib/dal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { formatCurrency, formatNumber, cn } from "@/lib/utils"
import { StockFilterForm } from "./stock-filter-form"
import { StockTransitionProvider, StockContentWrapper } from "./stock-transition-context"

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; warehouseId?: string; page?: string; stockFilter?: string }>
}) {
  await requirePermissionPage("STOCK_VIEW")
  const session = await getValidatedSession()
  const params = await searchParams
  const q = params.q?.trim() || ""
  const stockFilter = params.stockFilter || ""
  const page = Math.max(1, parseInt(params.page || "1", 10))
  const pageSize = 50

  const {
    warehouses,
    selectedWarehouseId,
    effectiveScopeIds: effectiveWarehouseIds,
  } = await resolveWarehouseContext(params.warehouseId, session!.userId)

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId)
  const warehouseLabel = selectedWarehouse ? selectedWarehouse.name : "Todos os Almoxarifados"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Estoque e Saldos</h2>
          <p className="text-muted-foreground text-sm">
            Acompanhe a disponibilidade física, reservas e valor monetário dos materiais.
          </p>
        </div>
      </div>

      <StockTransitionProvider>
        <StockFilterForm
          q={q}
          selectedWarehouseId={selectedWarehouseId}
          warehouses={warehouses}
          stockFilter={stockFilter}
        />

        <StockContentWrapper>
          <Suspense key={`${selectedWarehouseId}-${q}-${stockFilter}-${page}`} fallback={<StockSkeleton />}>
            <StockContent
              q={q}
              selectedWarehouseId={selectedWarehouseId}
              effectiveWarehouseIds={effectiveWarehouseIds}
              warehouseLabel={warehouseLabel}
              stockFilter={stockFilter}
              page={page}
              pageSize={pageSize}
            />
          </Suspense>
        </StockContentWrapper>
      </StockTransitionProvider>
    </div>
  )
}

async function StockContent({
  q,
  selectedWarehouseId,
  effectiveWarehouseIds,
  warehouseLabel,
  stockFilter,
  page,
  pageSize,
}: {
  q: string
  selectedWarehouseId: string
  effectiveWarehouseIds: string[] | null
  warehouseLabel: string
  stockFilter: string
  page: number
  pageSize: number
}) {
  const wFilter: Prisma.StockWhereInput = {}
  if (effectiveWarehouseIds !== null) {
    wFilter.warehouseId = { in: effectiveWarehouseIds }
  }

  const productWhere: Prisma.ProductWhereInput = {}
  if (q) {
    productWhere.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
    ]
  }

  if (effectiveWarehouseIds !== null) {
    productWhere.stocks = { some: wFilter }
  }

  // Fetch all slim items to compute KPIs and category ID collections
  const allMatchingProductsSlim = await db.product.findMany({
    where: productWhere,
    select: {
      id: true,
      averageCost: true,
      minimumStock: true,
      maximumStock: true,
      stocks: {
        where: wFilter,
        select: {
          quantity: true,
          reservedQuantity: true,
        },
      },
    },
  })

  let totalStockValue = 0
  let totalPhysicalQuantity = 0
  let totalReservedQuantity = 0
  let totalSkusInStock = 0
  let lowStockCount = 0
  let zeroStockCount = 0

  const inStockIds: string[] = []
  const alertIds: string[] = []

  for (const p of allMatchingProductsSlim) {
    const pQty = p.stocks.reduce((acc, s) => acc + Number(s.quantity), 0)
    const pRes = p.stocks.reduce((acc, s) => acc + Number(s.reservedQuantity), 0)
    const cost = Number(p.averageCost || 0)

    totalPhysicalQuantity += pQty
    totalReservedQuantity += pRes
    totalStockValue += pQty * cost

    if (pQty > 0) {
      totalSkusInStock++
      inStockIds.push(p.id)
    }

    if (pQty === 0) {
      zeroStockCount++
      alertIds.push(p.id)
    } else if (p.minimumStock > 0 && pQty <= p.minimumStock) {
      lowStockCount++
      alertIds.push(p.id)
    }
  }

  const totalAvailableQuantity = totalPhysicalQuantity - totalReservedQuantity
  const totalProductsCount = allMatchingProductsSlim.length

  // Filter products by selected card if active
  let targetProductIds: string[] | null = null
  if (stockFilter === "in_stock") {
    targetProductIds = inStockIds
  } else if (stockFilter === "alerts") {
    targetProductIds = alertIds
  }

  const filteredWhere: Prisma.ProductWhereInput = {
    ...productWhere,
    ...(targetProductIds !== null ? { id: { in: targetProductIds } } : {}),
  }

  const [displayTotalCount, products] = await Promise.all([
    targetProductIds !== null ? Promise.resolve(targetProductIds.length) : db.product.count({ where: productWhere }),
    db.product.findMany({
      where: filteredWhere,
      include: {
        category: true,
        unit: true,
        stocks: {
          where: wFilter,
          include: { location: true },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  const totalPages = Math.ceil(displayTotalCount / pageSize)

  const stockData = products.map((p) => {
    const totalQuantity = p.stocks.reduce((acc, stock) => acc + Number(stock.quantity), 0)
    const totalReserved = p.stocks.reduce((acc, stock) => acc + Number(stock.reservedQuantity), 0)
    const available = totalQuantity - totalReserved
    const unitCost = Number(p.averageCost || 0)
    const totalValue = totalQuantity * unitCost

    let status = "NORMAL"
    let statusLabel = "Normal"

    if (totalQuantity <= p.minimumStock && p.minimumStock > 0) {
      status = "LOW"
      statusLabel = "Baixo"
    } else if (totalQuantity >= p.maximumStock && p.maximumStock > 0) {
      status = "HIGH"
      statusLabel = "Excesso"
    }

    if (totalQuantity === 0) {
      status = "EMPTY"
      statusLabel = "Zerado"
    }

    return {
      product: p,
      totalQuantity,
      totalReserved,
      available,
      unitCost,
      totalValue,
      status,
      statusLabel,
    }
  })

  // URL Helpers
  const getCardFilterUrl = (targetFilter: "in_stock" | "alerts" | null) => {
    const p = new URLSearchParams()
    if (q) p.set("q", q)
    if (selectedWarehouseId) p.set("warehouseId", selectedWarehouseId)

    // Toggle: if already active, remove filter
    if (targetFilter && stockFilter !== targetFilter) {
      p.set("stockFilter", targetFilter)
    }
    return `/stock?${p.toString()}`
  }

  const buildParams = (newPage: number) => {
    const p = new URLSearchParams()
    if (q) p.set("q", q)
    if (selectedWarehouseId) p.set("warehouseId", selectedWarehouseId)
    if (stockFilter) p.set("stockFilter", stockFilter)
    p.set("page", String(newPage))
    return p.toString()
  }

  const clearFilterUrl = getCardFilterUrl(null)

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards (Clickable Filters) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Valor em Estoque */}
        <Link
          href={clearFilterUrl}
          title="Ver todos os produtos"
          className="block rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Card
            className={cn(
              "rounded-md border-border bg-card shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full group/card",
              !stockFilter && "border-border"
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover/card:text-foreground transition-colors">
                  Valor em Estoque
                </CardTitle>
                <InfoTooltip
                  title="Valor Total em Estoque"
                  text="Montante financeiro estimado, calculado pela soma da quantidade física de cada material multiplicada pelo seu custo médio ponderado."
                />
              </div>
              <div className="bg-amber-500/10 p-2 rounded-lg text-primary">
                <DollarSign className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-foreground">
                {formatCurrency(totalStockValue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate" title={warehouseLabel}>
                {selectedWarehouseId ? warehouseLabel : "Total em todos os almoxarifados"}
                {q ? ` • filtro: "${q}"` : ""}
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 2: Volume Físico */}
        <Link
          href={clearFilterUrl}
          title="Ver todos os produtos"
          className="block rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Card
            className={cn(
              "rounded-md border-border bg-card shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full group/card",
              !stockFilter && "border-border"
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover/card:text-foreground transition-colors">
                  Volume Físico Total
                </CardTitle>
                <InfoTooltip
                  title="Volume Físico Total"
                  text="Soma de todas as quantidades físicas (peças, barras, caixas, metros) de materiais estocados no almoxarifado."
                />
              </div>
              <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
                <Boxes className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-foreground inline-flex items-baseline">
                <span>{formatNumber(totalPhysicalQuantity)}</span>
                <span className="text-xs font-normal text-muted-foreground ml-1">un</span>
                <InfoTooltip
                  title="O que significa 'un'?"
                  text="Representa a unidade física de medida (unidades e peças somadas)."
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(totalAvailableQuantity)} disponíveis • {formatNumber(totalReservedQuantity)} reservadas
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 3: Itens com Saldo (Clickable Filter: in_stock) */}
        <Link
          href={getCardFilterUrl("in_stock")}
          title={stockFilter === "in_stock" ? "Clique para remover filtro" : "Clique para filtrar apenas itens com saldo"}
          className="block rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Card
            className={cn(
              "rounded-md bg-card shadow-sm hover:shadow-md transition-all cursor-pointer h-full group/card relative",
              stockFilter === "in_stock"
                ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/[0.04]"
                : "border-border hover:border-emerald-500/60"
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover/card:text-foreground transition-colors">
                  Itens com Saldo
                </CardTitle>
                <InfoTooltip
                  title="Itens com Saldo"
                  text="Quantidade de modelos ou produtos distintos cadastrados que possuem saldo físico maior que zero."
                />
              </div>
              <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-500">
                <PackageCheck className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-foreground inline-flex items-baseline">
                <span>{formatNumber(totalSkusInStock)}</span>
                <span className="text-xs font-normal text-muted-foreground ml-1">SKUs</span>
                <InfoTooltip
                  title="O que é SKU?"
                  text="SKU (Stock Keeping Unit) significa Unidade de Manutenção de Estoque. É o código identificador único de cada modelo ou tipo de material no catálogo. Este número indica quantos produtos diferentes possuem saldo físico disponível."
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  De {formatNumber(totalProductsCount)} tipos cadastrados
                </p>
                {stockFilter === "in_stock" ? (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Filtro Ativo ✕
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-muted-foreground/60 group-hover/card:text-emerald-500 transition-colors">
                    Filtrar 376 →
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 4: Alertas de Reposição (Clickable Filter: alerts) */}
        <Link
          href={getCardFilterUrl("alerts")}
          title={stockFilter === "alerts" ? "Clique para remover filtro" : "Clique para filtrar alertas de reposição"}
          className="block rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Card
            className={cn(
              "rounded-md bg-card shadow-sm hover:shadow-md transition-all cursor-pointer h-full group/card relative",
              stockFilter === "alerts"
                ? "border-orange-500 ring-2 ring-orange-500/30 bg-orange-500/[0.04]"
                : "border-border hover:border-orange-500/60"
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover/card:text-foreground transition-colors">
                  Alertas de Reposição
                </CardTitle>
                <InfoTooltip
                  title="Alertas de Reposição"
                  text="Materiais que exigem atenção imediata de compras ou reposição: produtos abaixo do estoque mínimo de segurança ou com saldo zerado."
                />
              </div>
              <div className="bg-orange-500/10 p-2 rounded-lg text-orange-500">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-foreground inline-flex items-baseline">
                <span>{formatNumber(lowStockCount + zeroStockCount)}</span>
                <span className="text-xs font-normal text-muted-foreground ml-1">alertas</span>
                <InfoTooltip
                  title="O que são estes alertas?"
                  text="Soma dos produtos que atingiram o ponto de reposição (estoque baixo) e dos produtos totalmente sem saldo (zerados)."
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  {lowStockCount} baixo • {zeroStockCount} zerados
                </p>
                {stockFilter === "alerts" ? (
                  <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/15 px-1.5 py-0.5 rounded border border-orange-500/20">
                    Filtro Ativo ✕
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-muted-foreground/60 group-hover/card:text-orange-500 transition-colors">
                    Filtrar →
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Active Filter Banner if filtered by a card */}
      {stockFilter && (
        <div className="flex items-center justify-between p-3 px-4 bg-primary/10 border border-primary/20 rounded-md text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Filtro aplicado:</span>
            {stockFilter === "in_stock" && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                Exibindo apenas Itens com Saldo ({displayTotalCount} produtos)
              </span>
            )}
            {stockFilter === "alerts" && (
              <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 font-medium border border-orange-500/20">
                Exibindo apenas Alertas de Reposição ({displayTotalCount} produtos)
              </span>
            )}
          </div>
          <Link
            href={clearFilterUrl}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline hover:text-primary/80 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Remover filtro
          </Link>
        </div>
      )}

      {/* Main Stock Table */}
      <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden flex flex-col">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-border/50">
          {stockData.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-base font-medium text-foreground mb-1">Nenhum produto encontrado</p>
              <p className="text-sm text-muted-foreground">
                Nenhum produto encontrado com os filtros atuais.
              </p>
              {stockFilter && (
                <div className="mt-4">
                  <Link href={clearFilterUrl}>
                    <Button variant="outline" size="sm" className="text-xs">
                      Limpar filtro de card
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            stockData.map((data) => (
              <div key={data.product.id} className="p-4 space-y-3 bg-transparent hover:bg-muted/20">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm uppercase">
                      {data.product.name.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <Link
                        href={`/stock/${data.product.id}`}
                        className="font-semibold text-sm text-foreground leading-tight hover:text-primary line-clamp-1"
                      >
                        {data.product.name}
                      </Link>
                      <span className="text-xs font-mono text-muted-foreground mt-0.5">
                        Cód: {data.product.code}
                      </span>
                    </div>
                  </div>
                  {data.status === "NORMAL" && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-medium whitespace-nowrap shrink-0">
                      <span className="h-1 w-1 rounded-full bg-emerald-600"></span>
                      Normal
                    </div>
                  )}
                  {data.status === "LOW" && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[10px] font-medium whitespace-nowrap shrink-0">
                      <span className="h-1 w-1 rounded-full bg-orange-600"></span>
                      Baixo
                    </div>
                  )}
                  {data.status === "HIGH" && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-medium whitespace-nowrap shrink-0">
                      <span className="h-1 w-1 rounded-full bg-blue-600"></span>
                      Excesso
                    </div>
                  )}
                  {data.status === "EMPTY" && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 text-[10px] font-medium whitespace-nowrap shrink-0">
                      <span className="h-1 w-1 rounded-full bg-red-600"></span>
                      Zerado
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs p-2.5 bg-muted/30 rounded-lg border border-border">
                  <div className="text-center">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">
                      Físico
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatNumber(data.totalQuantity)}{" "}
                      <span className="text-[10px]">{data.product.unit.code}</span>
                    </span>
                  </div>
                  <div className="text-center border-x border-border">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">
                      Reserv.
                    </span>
                    <span className="font-medium text-foreground">
                      {formatNumber(data.totalReserved)}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">
                      Disp.
                    </span>
                    <span className="font-bold text-primary">
                      {formatNumber(data.available)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs p-2 bg-muted/20 rounded-md border border-border">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Custo Médio
                    </span>
                    <span className="font-mono text-muted-foreground font-medium">
                      {formatCurrency(data.unitCost)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Valor Total
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {formatCurrency(data.totalValue)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 rounded bg-muted/50 border border-border text-[11px] font-medium text-muted-foreground">
                      {data.product.category.name}
                    </div>
                  </div>
                  <Link href={`/stock/${data.product.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                      <Box className="h-3.5 w-3.5" />
                      Ver Detalhes
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block w-full overflow-x-auto">
          <table className="w-full min-w-[1020px] text-sm text-left caption-bottom border-collapse">
            <thead className="bg-muted/40 border-b border-border">
              <tr className="hover:bg-transparent">
                <th className="h-11 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap w-[110px]">
                  Cód. Insumo
                </th>
                <th className="h-11 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider min-w-[200px] max-w-[280px] xl:max-w-[340px]">
                  Produto
                </th>
                <th className="h-11 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap w-[120px]">
                  Categoria
                </th>
                <th className="h-11 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right whitespace-nowrap w-[85px]">
                  Físico
                </th>
                <th className="h-11 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right whitespace-nowrap w-[80px]">
                  Reserv.
                </th>
                <th className="h-11 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right whitespace-nowrap w-[90px]">
                  Disponível
                </th>
                <th className="h-11 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right whitespace-nowrap w-[115px]">
                  <span className="inline-flex items-center justify-end gap-0.5 w-full">
                    Custo Méd.
                    <InfoTooltip text="Custo médio ponderado de aquisição da unidade do produto." iconClassName="h-3 w-3" />
                  </span>
                </th>
                <th className="h-11 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right whitespace-nowrap w-[115px]">
                  Valor Total
                </th>
                <th className="h-11 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center whitespace-nowrap w-[95px]">
                  <span className="inline-flex items-center justify-center gap-0.5 w-full">
                    Mín/Máx
                    <InfoTooltip text="Estoque Mínimo (ponto de ressuprimento) e Estoque Máximo definidos para o produto." iconClassName="h-3 w-3" />
                  </span>
                </th>
                <th className="h-11 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center whitespace-nowrap w-[95px]">
                  Status
                </th>
                <th className="h-11 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right whitespace-nowrap w-[60px]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stockData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="rounded-full bg-muted/50 p-4">
                        <Search className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-lg font-medium text-foreground">Nenhum produto encontrado</p>
                      <p className="text-sm text-muted-foreground">
                        {stockFilter
                          ? "Nenhum produto corresponde ao filtro selecionado pelo card."
                          : "Você ainda não possui produtos cadastrados ou encontrados no filtro."}
                      </p>
                      {stockFilter && (
                        <div className="pt-2">
                          <Link href={clearFilterUrl}>
                            <Button variant="outline" size="sm" className="text-xs">
                              Remover filtro do card
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                stockData.map((data) => (
                  <tr
                    key={data.product.id}
                    className="group hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {data.product.code}
                    </td>
                    <td className="px-4 py-3 min-w-[200px] max-w-[280px] xl:max-w-[340px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm group-hover:bg-primary group-hover:text-primary-foreground uppercase text-xs transition-colors">
                          {data.product.name.charAt(0)}
                        </div>
                        <Link
                          href={`/stock/${data.product.id}`}
                          title={data.product.name}
                          className="font-semibold text-sm text-foreground group-hover:text-primary truncate block hover:underline"
                        >
                          {data.product.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-muted-foreground bg-muted/50 px-2 py-0.5 rounded text-xs border border-border">
                        {data.product.category.name}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="font-semibold text-foreground text-sm">
                        {formatNumber(data.totalQuantity)}
                      </span>{" "}
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {data.product.unit.code}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-muted-foreground font-medium text-sm">
                        {formatNumber(data.totalReserved)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="font-bold text-sm text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">
                        {formatNumber(data.available)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatCurrency(data.unitCost)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="font-semibold text-xs font-mono text-foreground">
                        {formatCurrency(data.totalValue)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-muted-foreground whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 opacity-80">
                        <span>{data.product.minimumStock}</span>
                        <span className="opacity-40">/</span>
                        <span>
                          {data.product.maximumStock > 0 ? data.product.maximumStock : "∞"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {data.status === "NORMAL" && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-[pulse_2s_ease-in-out_infinite]"></span>
                          Normal
                        </div>
                      )}
                      {data.status === "LOW" && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-[pulse_2s_ease-in-out_infinite]"></span>
                          Baixo
                        </div>
                      )}
                      {data.status === "HIGH" && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                          Excesso
                        </div>
                      )}
                      {data.status === "EMPTY" && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-600"></span>
                          Zerado
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/stock/${data.product.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ver Detalhes e Distribuição"
                          className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Box className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 bg-muted/20 mt-auto">
          <div className="text-sm text-muted-foreground">
            Mostrando{" "}
            <strong>{displayTotalCount > 0 ? (page - 1) * pageSize + 1 : 0}</strong> a{" "}
            <strong>{Math.min(page * pageSize, displayTotalCount)}</strong> de{" "}
            <strong>{displayTotalCount}</strong> produtos encontrados
            {stockFilter === "in_stock" && " (Filtro: Apenas com saldo)"}
            {stockFilter === "alerts" && " (Filtro: Alertas de reposição)"}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">
                Página {page} de {totalPages}
              </span>
              <Link href={page > 1 ? `/stock?${buildParams(page - 1)}` : "#"}>
                <Button variant="outline" size="sm" disabled={page <= 1} className="h-8 text-xs">
                  Anterior
                </Button>
              </Link>
              <Link href={page < totalPages ? `/stock?${buildParams(page + 1)}` : "#"}>
                <Button variant="outline" size="sm" disabled={page >= totalPages} className="h-8 text-xs">
                  Próxima
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StockSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-md bg-muted/40 border border-border" />
        ))}
      </div>
      <div className="h-96 rounded-md bg-muted/30 border border-border flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-60" />
      </div>
    </div>
  )
}
