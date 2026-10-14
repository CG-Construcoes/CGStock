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

      <div className="bg-card  rounded-md border border-border shadow-sm  overflow-hidden  ">
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
  )
}
