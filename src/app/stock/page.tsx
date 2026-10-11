import { Suspense } from "react"
import { Search, Filter, Box, Loader2 } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { getAccessibleWarehouseIds } from "@/lib/dal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StockFilterForm } from "./stock-filter-form"

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string, warehouseId?: string }> }) {
  await requirePermissionPage('STOCK_VIEW')
  const session = await getValidatedSession()
  const params = await searchParams
  const q = params.q || ""
  const selectedWarehouseId = params.warehouseId || ""

  const allowedIds = await getAccessibleWarehouseIds(session!.userId)
  
  let warehouses = []
  if (allowedIds === null) {
    warehouses = await db.warehouse.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } })
  } else {
    warehouses = await db.warehouse.findMany({ where: { status: 'ACTIVE', id: { in: allowedIds } }, orderBy: { name: 'asc' } })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Estoque e Saldos</h2>
          <p className="text-muted-foreground">Acompanhe a disponibilidade física dos materiais no almoxarifado.</p>
        </div>
      </div>

      <StockFilterForm q={q} selectedWarehouseId={selectedWarehouseId} warehouses={warehouses} />

      <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <StockList q={q} selectedWarehouseId={selectedWarehouseId} allowedIds={allowedIds} />
      </Suspense>
    </div>
  )
}

async function StockList({ q, selectedWarehouseId, allowedIds }: { q: string, selectedWarehouseId: string, allowedIds: string[] | null }) {
  let effectiveWarehouseIds = allowedIds
  if (selectedWarehouseId) {
    if (allowedIds === null || allowedIds.includes(selectedWarehouseId)) {
      effectiveWarehouseIds = [selectedWarehouseId]
    }
  }

  const wFilter: any = {}
  if (effectiveWarehouseIds !== null) {
    wFilter.warehouseId = { in: effectiveWarehouseIds }
  }

  const productWhere: any = {}
  if (q) {
    productWhere.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } }
    ]
  }
  
  if (effectiveWarehouseIds !== null) {
    productWhere.stocks = { some: wFilter }
  }

  const products = await db.product.findMany({
    where: productWhere,
    include: {
      category: true,
      unit: true,
      stocks: {
        where: wFilter,
        include: { location: true }
      }
    },
    orderBy: { name: 'asc' }
  })

  const stockData = products.map(p => {
    const totalQuantity = p.stocks.reduce((acc, stock) => acc + Number(stock.quantity), 0)
    const totalReserved = p.stocks.reduce((acc, stock) => acc + Number(stock.reservedQuantity), 0)
    const available = totalQuantity - totalReserved

    let status = 'NORMAL'
    let statusLabel = 'Normal'
    let variant = 'success'

    if (totalQuantity <= p.minimumStock && p.minimumStock > 0) {
      status = 'LOW'
      statusLabel = 'Baixo'
      variant = 'warning'
    } else if (totalQuantity >= p.maximumStock && p.maximumStock > 0) {
      status = 'HIGH'
      statusLabel = 'Excesso'
      variant = 'default'
    }

    if (totalQuantity === 0) {
      status = 'EMPTY'
      statusLabel = 'Zerado'
      variant = 'secondary'
    }

    return {
      product: p,
      totalQuantity,
      totalReserved,
      available,
      status,
      statusLabel,
      variant
    }
  })

  return (
    <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-border/50">
          {stockData.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-base font-medium text-foreground mb-1">Nenhum produto em estoque</p>
              <p className="text-sm text-muted-foreground">Você ainda não possui produtos cadastrados ou encontrados no filtro.</p>
            </div>
          ) : (
            stockData.map((data) => (
              <div key={data.product.id} className="p-5 space-y-4 bg-transparent hover:bg-muted/20">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm uppercase">
                      {data.product.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <Link href={`/stock/${data.product.id}`} className="font-semibold text-base text-foreground leading-tight hover:text-primary line-clamp-1">
                        {data.product.name}
                      </Link>
                      <span className="text-xs text-muted-foreground mt-0.5">Cod: {data.product.code}</span>
                    </div>
                  </div>
                  {data.status === 'NORMAL' && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-medium whitespace-nowrap">
                      <span className="h-1 w-1 rounded-full bg-emerald-600"></span>
                      Normal
                    </div>
                  )}
                  {data.status === 'LOW' && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[10px] font-medium whitespace-nowrap">
                      <span className="h-1 w-1 rounded-full bg-orange-600"></span>
                      Baixo
                    </div>
                  )}
                  {data.status === 'HIGH' && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-medium whitespace-nowrap">
                      <span className="h-1 w-1 rounded-full bg-blue-600"></span>
                      Excesso
                    </div>
                  )}
                  {data.status === 'EMPTY' && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 text-[10px] font-medium whitespace-nowrap">
                      <span className="h-1 w-1 rounded-full bg-red-600"></span>
                      Zerado
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-3 text-sm p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="text-center">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Físico</span>
                    <span className="font-medium text-foreground">{data.totalQuantity} <span className="text-[10px]">{data.product.unit.code}</span></span>
                  </div>
                  <div className="text-center border-x border-border">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Reserv.</span>
                    <span className="font-medium text-foreground">{data.totalReserved}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Disp.</span>
                    <span className="font-bold text-primary">{data.available}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 rounded-full bg-secondary/50 border border-border text-xs font-medium text-muted-foreground">
                      {data.product.category.name}
                    </div>
                  </div>
                  <Link href={`/stock/${data.product.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-blue-500/10 hover:text-blue-600">
                      <Box className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto p-1">
          <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Cód. Insumo</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Produto</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Categoria</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider text-right">Físico</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider text-right">Reservado</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider text-right">Disponível</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Min/Máx</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Status</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockData.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="rounded-full bg-muted/50 p-4">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-lg font-medium text-foreground">Nenhum produto encontrado</p>
                    <p className="text-sm text-muted-foreground">Você ainda não possui produtos cadastrados ou encontrados no filtro.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              stockData.map((data) => (
                <TableRow 
                  key={data.product.id}
                  className="group border-b border-border hover:bg-primary/[0.02]"
                >
                  <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">{data.product.code}</TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm group-hover:bg-primary group-hover:text-primary-foreground uppercase text-sm">
                        {data.product.name.charAt(0)}
                      </div>
                      <Link href={`/stock/${data.product.id}`} className="font-semibold text-base text-foreground group-hover:text-primary">
                        {data.product.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className="text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-border text-sm">
                      {data.product.category.name}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <span className="font-semibold text-foreground">{data.totalQuantity}</span> <span className="text-[10px] text-muted-foreground uppercase">{data.product.unit.code}</span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <span className="text-muted-foreground font-medium">{data.totalReserved}</span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <span className="font-bold text-base text-primary bg-primary/5 px-3 py-1 rounded-md border border-primary/10">{data.available}</span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="opacity-70">{data.product.minimumStock}</span>
                      <span className="opacity-40">/</span>
                      <span className="opacity-70">{data.product.maximumStock > 0 ? data.product.maximumStock : '∞'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {data.status === 'NORMAL' && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-sm font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-[pulse_2s_ease-in-out_infinite]"></span>
                        Normal
                      </div>
                    )}
                    {data.status === 'LOW' && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-sm font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-[pulse_2s_ease-in-out_infinite]"></span>
                        Baixo
                      </div>
                    )}
                    {data.status === 'HIGH' && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-sm font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                        Excesso
                      </div>
                    )}
                    {data.status === 'EMPTY' && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 text-sm font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600"></span>
                        Zerado
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <Link href={`/stock/${data.product.id}`}>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        title="Ver Distribuição"
                        className="h-9 w-9 rounded-full opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 hover:text-blue-600 translate-x-2 group-hover:translate-x-0 transition-all"
                      >
                        <Box className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
  )
}
