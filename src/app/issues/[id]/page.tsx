import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {  Package, User, CheckCircle, Clock } from "lucide-react"
import Link from "next/link"
import { BackButton } from "@/components/ui/back-button"
import { requireAnyPermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { assertWarehouseAccess } from "@/lib/dal"

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyPermissionPage('STOCK_EXIT', 'REQUEST_FULFILL')
  const { id } = await params
  
  // Detalhes da saída (baseados na requisição que gerou a saída)
  const req = await db.materialRequest.findUnique({
    where: { id },
    include: {
      requester: true,
      warehouse: true,
      approvedBy: true,
      items: {
        where: { deliveredQuantity: { gt: 0 } },
        include: {
          product: { select: { code: true, name: true } },
          unit: true
        }
      }
    }
  })

  if (!req || req.items.length === 0) notFound()
  await assertWarehouseAccess(req.warehouseId, (await getValidatedSession())!.userId)

  // Buscar as movimentações (StockMovement) ligadas a esta requisição
  const movements = await db.stockMovement.findMany({
    where: {
      referenceType: 'MATERIAL_REQUEST',
      referenceId: req.id,
      warehouseId: req.warehouseId,
      type: 'EXIT'
    },
    include: {
      product: { select: { code: true, name: true } },
      location: true,
      performedBy: true
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Saída Ref: {req.requestNumber}</h2>
              <Badge variant="success">Finalizada</Badge>
            </div>
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <CheckCircle className="h-4 w-4" /> Entregue em {req.fulfilledAt ? new Date(req.fulfilledAt).toLocaleString('pt-BR') : '-'}
            </p>
          </div>
        </div>
        <Link href={`/requests/${req.id}`}>
          <Button variant="outline" className="flex items-center gap-2">
            Ver Requisição Original
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <User className="h-4 w-4" /> Solicitante original
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-lg">{req.requester.name}</p>
            <p className="text-sm text-muted-foreground">Aprovado por: {req.approvedBy?.name || '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <Package className="h-4 w-4" /> Origem do Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-lg">{req.warehouse.name}</p>
            <p className="text-sm text-muted-foreground">Local principal de retirada</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Histórico Oficial de Saídas (Stock Movements)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile View: Cards */}
          <div className="md:hidden divide-y divide-border">
            {movements.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Nenhuma movimentação registrada.
              </div>
            ) : (
              movements.map((mov) => (
                <div key={mov.id} className="p-4 space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-bold text-base text-foreground block">{mov.product.name}</span>
                      <span className="text-xs text-muted-foreground">Cód: {mov.product.code}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-base text-red-600 dark:text-red-400 block">
                        -{Number(mov.quantity)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs bg-muted/30 p-2 rounded-lg border border-border/50">
                    <span className="text-muted-foreground">Local de retirada:</span>
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Badge variant="outline" className="font-mono bg-muted/60 text-[10px] px-1.5 py-0.5">{mov.location.code}</Badge>
                      <span className="truncate max-w-[150px]">{mov.location.name}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(mov.createdAt).toLocaleString('pt-BR')}
                    </span>
                    <span>Por {mov.performedBy.name}</span>
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
                  <TableHead className="pl-6">Data/Hora</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Localização Retirada</TableHead>
                  <TableHead className="text-right">Qtd Retirada</TableHead>
                  <TableHead className="pr-6">Executado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map(mov => (
                  <TableRow key={mov.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {new Date(mov.createdAt).toLocaleString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{mov.product.code}</span> - {mov.product.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono bg-muted/50">{mov.location.code}</Badge>
                      <span className="ml-2 text-sm">{mov.location.name}</span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                      -{Number(mov.quantity)}
                    </TableCell>
                    <TableCell className="pr-6">
                      {mov.performedBy.name}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
