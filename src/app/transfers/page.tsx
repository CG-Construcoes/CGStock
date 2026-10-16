import { db } from "@/lib/db"
import { resolveWarehouseContext } from "@/lib/dal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRightLeft, Plus } from "lucide-react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BackButton } from "@/components/ui/back-button"
import { WarehouseSelectFilter } from "@/components/ui/warehouse-select-filter"
import { requirePermissionPage } from "@/lib/permissions"
import { Prisma } from "@prisma/client"
import { Suspense } from "react"

export default async function TransfersPage(props: {
  searchParams?: Promise<{ warehouseId?: string }>
}) {
  await requirePermissionPage('STOCK_TRANSFER')
  const resolvedParams = props?.searchParams ? await props.searchParams : {}
  const { warehouses, selectedWarehouseId, effectiveScopeIds: scope } = await resolveWarehouseContext(resolvedParams.warehouseId)

  let whereClause: Prisma.StockTransferWhereInput | undefined
  if (selectedWarehouseId) {
    whereClause = {
      OR: [
        { sourceWarehouseId: selectedWarehouseId },
        { destinationWarehouseId: selectedWarehouseId }
      ]
    }
  } else if (scope !== null) {
    whereClause = {
      sourceWarehouseId: { in: scope },
      destinationWarehouseId: { in: scope }
    }
  }

  const transfers = await db.stockTransfer.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      sourceWarehouse: true,
      sourceLocation: true,
      destinationWarehouse: true,
      destinationLocation: true,
      createdBy: true,
      _count: { select: { items: true } }
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Transferências</h2>
            <p className="text-muted-foreground">Movimentações entre almoxarifados ou localizações.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {warehouses.length > 1 && (
            <Suspense fallback={null}>
              <WarehouseSelectFilter
                warehouses={warehouses}
                selectedWarehouseId={selectedWarehouseId}
                className="w-full sm:w-60"
              />
            </Suspense>
          )}
          <Link href="/transfers/new">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova Transferência
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-border">
          {transfers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <ArrowRightLeft className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              Nenhuma transferência registrada.
            </div>
          ) : (
            transfers.map((trf) => (
              <div key={trf.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-bold text-base text-foreground block">{trf.transferNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(trf.createdAt).toLocaleDateString('pt-BR')} • {trf.createdBy.name}
                    </span>
                  </div>
                  <div>
                    {trf.status === 'DRAFT' && <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Rascunho</Badge>}
                    {trf.status === 'IN_TRANSIT' && <Badge variant="secondary">Em Trânsito</Badge>}
                    {trf.status === 'COMPLETED' && <Badge variant="success">Concluído</Badge>}
                    {trf.status === 'CANCELLED' && <Badge variant="destructive">Cancelado</Badge>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">De (Origem)</span>
                    <span className="font-semibold text-foreground">{trf.sourceLocation.code}</span>
                    <span className="text-muted-foreground block truncate">{trf.sourceWarehouse.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Para (Destino)</span>
                    <span className="font-semibold text-foreground">{trf.destinationLocation.code}</span>
                    <span className="text-muted-foreground block truncate">{trf.destinationWarehouse.name}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                  <span>Itens transferidos</span>
                  <span className="font-bold text-foreground text-sm">{trf._count.items} {trf._count.items === 1 ? 'item' : 'itens'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <ArrowRightLeft className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    Nenhuma transferência registrada.
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map(trf => (
                  <TableRow key={trf.id}>
                    <TableCell className="font-medium">{trf.transferNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{trf.sourceLocation.code}</div>
                      <div className="text-xs text-muted-foreground">{trf.sourceWarehouse.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{trf.destinationLocation.code}</div>
                      <div className="text-xs text-muted-foreground">{trf.destinationWarehouse.name}</div>
                    </TableCell>
                    <TableCell className="text-center">{trf._count.items}</TableCell>
                    <TableCell>{trf.createdBy.name}</TableCell>
                    <TableCell>{new Date(trf.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {trf.status === 'DRAFT' && <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Rascunho</Badge>}
                      {trf.status === 'IN_TRANSIT' && <Badge variant="secondary">Em Trânsito</Badge>}
                      {trf.status === 'COMPLETED' && <Badge variant="success">Concluído</Badge>}
                      {trf.status === 'CANCELLED' && <Badge variant="destructive">Cancelado</Badge>}
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
