import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Edit } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { resolveWarehouseContext } from "@/lib/dal"
import { SearchInput } from "@/components/ui/search-input"
import { WarehouseSelectFilter } from "@/components/ui/warehouse-select-filter"
import { requirePermissionPage } from "@/lib/permissions"
import { Suspense } from "react"

export default async function LocationsPage(props: {
  searchParams?: Promise<{ q?: string; warehouseId?: string }>
}) {
  await requirePermissionPage('STOCK_VIEW')
  const resolvedParams = props?.searchParams ? await props.searchParams : {}
  const q = resolvedParams.q || ''
  const { warehouses, selectedWarehouseId, warehouseWhere } = await resolveWarehouseContext(resolvedParams.warehouseId)

  const locations = await db.warehouseLocation.findMany({
    where: {
      ...warehouseWhere,
      ...(q ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { warehouse: { name: { contains: q, mode: 'insensitive' } } },
          { warehouse: { code: { contains: q, mode: 'insensitive' } } },
        ]
      } : {})
    },
    orderBy: [{ warehouseId: 'asc' }, { code: 'asc' }],
    include: {
      warehouse: true,
      parent: true,
      _count: {
        select: { products: true, stocks: true }
      }
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Localizações</h2>
          <p className="text-muted-foreground">Mapeie os corredores, estantes e prateleiras dos almoxarifados.</p>
        </div>
        <Link href="/locations/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Localização
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-md border border-border shadow-sm">
        <SearchInput placeholder="Buscar por código, nome ou almoxarifado..." />
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

      <div className="bg-card  rounded-md border border-border shadow-sm  overflow-hidden  ">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-border/50">
          {locations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-base font-medium text-foreground mb-1">Nenhuma localização</p>
              <p className="text-sm text-muted-foreground">Você ainda não possui localizações cadastradas.</p>
            </div>
          ) : (
            locations.map((location) => (
              <div key={location.id} className="p-5 space-y-4 bg-transparent hover:bg-muted/20 ">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm uppercase">
                      {location.code.substring(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base text-foreground leading-tight">
                          {location.name}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 rounded uppercase">{location.code}</span>
                      </div>
                      <span className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">
                        {location.warehouse.code}
                      </span>
                    </div>
                  </div>
                  {location.status === 'ACTIVE' ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-medium whitespace-nowrap">
                      <span className="h-1 w-1 rounded-full bg-emerald-600 "></span>
                      Ativo
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600 border border-zinc-500/20 text-[10px] font-medium whitespace-nowrap">
                      <span className="h-1 w-1 rounded-full bg-zinc-600"></span>
                      Inativo
                    </div>
                  )}
                </div>
                
                <div className="text-sm p-3 bg-muted/30 rounded-lg border border-border">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Localização Pai</span>
                  <span className="font-medium text-foreground">{location.parent ? `${location.parent.code} - ${location.parent.name}` : '-'}</span>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 rounded-full bg-secondary/50 border border-border text-xs font-medium text-muted-foreground">
                      <span className="text-foreground font-semibold mr-1">{location._count.stocks}</span>
                      itens em estoque
                    </div>
                  </div>
                  <Link href={`/locations/${location.id}/edit`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-blue-500/10 hover:text-blue-600 ">
                      <Edit className="h-4 w-4" />
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
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Almoxarifado</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Código</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Nome</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Localização Pai</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider text-center">Produtos</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Status</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="rounded-full bg-muted/50 p-4">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-lg font-medium text-foreground">Nenhuma localização encontrada</p>
                    <p className="text-sm text-muted-foreground">Você ainda não possui localizações cadastradas no sistema.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              locations.map((location) => (
                <TableRow 
                  key={location.id}
                  className="group border-b border-border hover:bg-primary/[0.02]   "
                >
                  <TableCell className="px-6 py-4">
                    <span className="font-semibold text-sm text-muted-foreground tracking-tight bg-muted/30 px-2.5 py-1 rounded-md border border-border">
                      {location.warehouse.code}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className="font-bold text-sm text-foreground bg-secondary/50 px-2 py-1 rounded border border-border uppercase">
                      {location.code}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 font-semibold text-base text-foreground group-hover:text-primary  ">
                    {location.name}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground text-sm">
                    {location.parent ? `${location.parent.code} - ${location.parent.name}` : '-'}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    <div className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 rounded-full bg-secondary/60 border border-border text-sm font-semibold text-foreground">
                      {location._count.stocks}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {location.status === 'ACTIVE' ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-sm font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-[pulse_2s_ease-in-out_infinite]"></span>
                        Ativo
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-500/10 text-zinc-600 border border-zinc-500/20 text-sm font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600"></span>
                        Inativo
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <Link href={`/locations/${location.id}/edit`}>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9 rounded-full opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 hover:text-blue-600   translate-x-2 group-hover:translate-x-0"
                      >
                        <Edit className="h-4 w-4" />
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
    </div>
  )
}
