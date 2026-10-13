import { db } from "@/lib/db"
import { warehouseIdFilter } from "@/lib/dal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {  RotateCcw, Plus } from "lucide-react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function ReturnsPage() {
  await requirePermissionPage('STOCK_ENTRY')
  const returns = await db.materialReturn.findMany({
    where: await warehouseIdFilter(),
    orderBy: { createdAt: 'desc' },
    include: {
      warehouse: true,
      request: true,
      returnedBy: true,
      _count: { select: { items: true } }
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Devoluções</h2>
            <p className="text-muted-foreground">Controle de materiais devolvidos ao estoque.</p>
          </div>
        </div>
        <Link href="/returns/new">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Devolução
          </Button>
        </Link>
      </div>

      <div className="bg-card  rounded-md border border-border/50 shadow-sm  overflow-hidden  ">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-border/50">
          {returns.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground flex flex-col items-center">
              <RotateCcw className="h-10 w-10 text-muted-foreground/30 mb-3" />
              Nenhuma devolução registrada.
            </div>
          ) : (
            returns.map(ret => (
              <div key={ret.id} className="p-4 space-y-3 bg-card hover:bg-muted/30 ">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Num: {ret.returnNumber}
                    </span>
                    <span className="font-bold text-base text-foreground leading-tight">
                      {ret.returnedBy.name}
                    </span>
                  </div>
                  <div>
                    {ret.status === 'DRAFT' && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">Rascunho</Badge>}
                    {ret.status === 'RECEIVED' && <Badge variant="success" className="text-[10px]">Recebido</Badge>}
                    {ret.status === 'CANCELLED' && <Badge variant="destructive" className="text-[10px]">Cancelado</Badge>}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Data</span>
                    <span className="font-medium text-foreground">
                      {new Date(ret.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Req. Original</span>
                    {ret.request ? (
                      <Link href={`/requests/${ret.requestId}`} className="text-primary font-medium hover:underline">
                        {ret.request.requestNumber}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex flex-col text-xs text-muted-foreground">
                    <span>Local: <span className="font-medium text-foreground">{ret.warehouse.name}</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium">
                    {ret._count.items} <span className="text-xs text-muted-foreground font-normal">itens</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Almoxarifado</TableHead>
              <TableHead>Devolvido Por</TableHead>
              <TableHead>Req. Original</TableHead>
              <TableHead className="text-center">Itens</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <RotateCcw className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  Nenhuma devolução registrada.
                </TableCell>
              </TableRow>
            ) : (
              returns.map(ret => (
                <TableRow key={ret.id}>
                  <TableCell className="font-medium">{ret.returnNumber}</TableCell>
                  <TableCell>{ret.warehouse.name}</TableCell>
                  <TableCell>{ret.returnedBy.name}</TableCell>
                  <TableCell>
                    {ret.request ? (
                      <Link href={`/requests/${ret.requestId}`} className="text-primary hover:underline">
                        {ret.request.requestNumber}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{ret._count.items}</TableCell>
                  <TableCell>{new Date(ret.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {ret.status === 'DRAFT' && <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Rascunho</Badge>}
                    {ret.status === 'RECEIVED' && <Badge variant="success">Recebido</Badge>}
                    {ret.status === 'CANCELLED' && <Badge variant="destructive">Cancelado</Badge>}
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
