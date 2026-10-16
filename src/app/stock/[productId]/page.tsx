import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {  Box, Package, Info, MapPin } from "lucide-react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BackButton } from "@/components/ui/back-button"
import { WarehouseSelectFilter } from "@/components/ui/warehouse-select-filter"
import { getMovementTypeLabel, isInMovement } from "@/lib/movement-labels"
import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { resolveWarehouseContext } from "@/lib/dal"
import { Suspense } from "react"

export default async function ProductStockPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>
  searchParams?: Promise<{ warehouseId?: string }>
}) {
  await requirePermissionPage('STOCK_VIEW')
  const session = await getValidatedSession()
  const resolvedSearch = searchParams ? await searchParams : {}
  const { warehouses, selectedWarehouseId, warehouseWhere: wFilter } = await resolveWarehouseContext(resolvedSearch.warehouseId, session!.userId)
  const { productId } = await params
  
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      unit: true,
      stocks: {
        where: wFilter,
        include: { location: { include: { warehouse: true } } }
      },
      movements: {
        where: wFilter,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { performedBy: true, location: true }
      }
    }
  })

  if (!product) notFound()

  const totalQuantity = product.stocks.reduce((acc, stock) => acc + Number(stock.quantity), 0)
  const totalReserved = product.stocks.reduce((acc, stock) => acc + Number(stock.reservedQuantity), 0)
  const available = totalQuantity - totalReserved

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">{product.name}</h2>
              <Badge variant="outline">{product.code}</Badge>
            </div>
            <p className="text-muted-foreground">{product.category.name} • {product.unit.name}</p>
          </div>
        </div>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-5 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium truncate">Estoque Físico</CardTitle>
            <Package className="h-4 w-4 text-blue-500 shrink-0" />
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">{totalQuantity.toLocaleString("pt-BR")}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">Total nas localizações</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-5 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium truncate">Reservado</CardTitle>
            <Info className="h-4 w-4 text-yellow-500 shrink-0" />
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">{totalReserved.toLocaleString("pt-BR")}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">Aguardando saída</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/60 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-5 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-300 truncate">Disponível</CardTitle>
            <Box className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-400">{available.toLocaleString("pt-BR")}</div>
            <p className="text-[11px] sm:text-xs text-blue-600/80 dark:text-blue-400/80 mt-1 truncate">Livre para uso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-5 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium truncate">Parâmetros</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
            <div className="flex flex-col gap-0.5 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mínimo:</span>
                <span className="font-semibold">{product.minimumStock}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Máximo:</span>
                <span className="font-semibold">{product.maximumStock > 0 ? product.maximumStock : 'Não def.'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Localização</CardTitle>
          </CardHeader>
          <CardContent>
            {product.stocks.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                Produto não possui saldo em nenhuma localização.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Almoxarifado</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Físico</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.stocks.map(stock => (
                    <TableRow key={stock.id}>
                      <TableCell className="font-medium text-sm">
                        {stock.location.warehouse.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{stock.location.code}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(stock.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Últimas Movimentações</CardTitle>
            <Link href={`/movements?productId=${product.id}`}>
              <Button variant="link" size="sm" className="h-auto p-0">Ver todas</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {product.movements.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                Nenhuma movimentação registrada.
              </div>
            ) : (
              <div className="space-y-4">
                {product.movements.map(mov => (
                  <div key={mov.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={isInMovement(mov.type) ? 'success' : 'destructive'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {getMovementTypeLabel(mov.type, mov.referenceType)}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground">
                          {new Date(mov.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm font-medium">
                        {mov.documentNumber ? `Doc: ${mov.documentNumber}` : 'Sem documento'}
                      </p>
                      <p className="text-xs text-muted-foreground">Local: {mov.location.code} • Por: {mov.performedBy.name.split(' ')[0]}</p>
                    </div>
                    <div className={`font-bold text-lg ${isInMovement(mov.type) ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isInMovement(mov.type) ? '+' : '-'}{Math.abs(Number(mov.quantity))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
