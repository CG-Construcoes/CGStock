import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {  ArrowRightLeft, Plus } from "lucide-react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function TransfersPage() {
  await requirePermissionPage('STOCK_TRANSFER')
  const transfers = await db.stockTransfer.findMany({
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Transferências</h2>
            <p className="text-muted-foreground">Movimentações entre almoxarifados ou localizações.</p>
          </div>
        </div>
        <Link href="/transfers/new">
          <Button className="bg-primary hover:bg-primary text-white flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Transferência
          </Button>
        </Link>
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
