import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Eye, ArrowRight, ArrowLeft } from "lucide-react"
import { db } from "@/lib/db"
import Link from "next/link"
import { Prisma } from "@prisma/client"
import { MovementsFilterForm } from "./filter-form"
import { format } from "date-fns"
import { getMovementTypeLabel, getMovementBadgeVariant, isInMovement, isManualAdjustment } from "@/lib/movement-labels"
import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { resolveWarehouseContext } from "@/lib/dal"

export default async function MovementsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await requirePermissionPage('STOCK_VIEW')
  const session = await getValidatedSession()
  const searchParams = await props.searchParams;
  const page = Number(searchParams.page) || 1
  const pageSize = 20
  const skip = (page - 1) * pageSize

  const warehouseParam = searchParams.warehouseId as string | undefined
  const { warehouses, selectedWarehouseId, warehouseWhere } = await resolveWarehouseContext(warehouseParam, session!.userId)

  // Build filter query
  const where: Prisma.StockMovementWhereInput = { ...warehouseWhere }
  
  const typeParam = searchParams.type as string
  if (typeParam) where.type = typeParam

  const productParam = searchParams.productId as string
  if (productParam) where.productId = productParam

  const refTypeParam = searchParams.referenceType as string
  if (refTypeParam) where.referenceType = refTypeParam

  const search = searchParams.q as string
  if (search) {
    where.OR = [
      { documentNumber: { contains: search, mode: 'insensitive' } },
      { product: { name: { contains: search, mode: 'insensitive' } } },
      { product: { code: { contains: search, mode: 'insensitive' } } }
    ]
  }

  const [movements, totalCount, products, agg] = await Promise.all([
    db.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, code: true, name: true, unit: { select: { code: true } } } },
        location: { select: { id: true, code: true, warehouse: { select: { name: true } } } },
        performedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    }),
    db.stockMovement.count({ where }),
    db.product.findMany({
      where: { movements: { some: warehouseWhere || {} } },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
      take: 250
    }),
    productParam
      ? db.stockMovement.groupBy({
          by: ['type'],
          where,
          _sum: { quantity: true }
        })
      : Promise.resolve(null),
  ])

  const totalPages = Math.ceil(totalCount / pageSize)

  // Calculate summary if only 1 product is selected
  let summary = null
  if (agg) {
    let totalIn = 0
    let totalOut = 0
    agg.forEach(a => {
      const q = Math.abs(Number(a._sum.quantity || 0))
      if (isInMovement(a.type)) totalIn += q
      else totalOut += q
    })
    summary = { totalIn, totalOut }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Extrato de Estoque</h2>
          <p className="text-muted-foreground">Registro global e imutável de todas as alterações de estoque.</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card  p-4 rounded-md border border-border shadow-sm  ">
            <p className="text-sm font-semibold text-muted-foreground">Entradas Totais</p>
            <p className="text-3xl font-black text-success mt-1">+{summary.totalIn}</p>
          </div>
          <div className="bg-card  p-4 rounded-md border border-border shadow-sm  ">
            <p className="text-sm font-semibold text-muted-foreground">Saídas Totais</p>
            <p className="text-3xl font-black text-destructive mt-1">-{summary.totalOut}</p>
          </div>
          <div className="bg-card  p-4 rounded-md border border-border shadow-sm  ">
            <p className="text-sm font-semibold text-muted-foreground">Movimentações no Filtro</p>
            <p className="text-3xl font-black text-foreground mt-1">{totalCount}</p>
          </div>
        </div>
      )}

      {/* Filter Form Component */}
      <MovementsFilterForm 
        products={products} 
        warehouses={warehouses} 
        defaultValues={{
          q: search || "",
          type: typeParam || "",
          productId: productParam || "",
          warehouseId: selectedWarehouseId || "",
          referenceType: refTypeParam || ""
        }} 
      />

      <div className="bg-card  rounded-md border border-border/50 shadow-sm  overflow-hidden  ">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-border/50">
          {movements.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhuma movimentação registrada para este filtro.
            </div>
          ) : (
            movements.map((mov) => {
              const isPositive = isInMovement(mov.type)
              const typeLabel = getMovementTypeLabel(mov.type, mov.referenceType)
              const badgeVariant = getMovementBadgeVariant(mov.type, isManualAdjustment(mov.referenceType))

              return (
                <div key={mov.id} className="p-4 space-y-3 hover:bg-muted/30 ">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">{mov.product.code}</span>
                      <span className="font-bold text-base text-foreground leading-tight">
                        {mov.product.name}
                      </span>
                    </div>
                    <Badge variant={badgeVariant} className="text-[10px] px-2 py-0.5">
                      {typeLabel}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Qtd</span>
                      <span className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : '-'}{Math.abs(Number(mov.quantity))} <span className="text-xs font-normal opacity-70">{mov.product.unit.code}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Local</span>
                      <span className="font-medium text-foreground">{mov.location.code}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span>{format(new Date(mov.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                      <span>Por: {mov.performedBy.name.split(' ')[0]}</span>
                    </div>
                    <Link href={`/movements/${mov.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4 text-primary" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Local / Origem</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Nenhuma movimentação registrada para este filtro.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((mov) => {
                const isPositive = isInMovement(mov.type)
                const typeLabel = getMovementTypeLabel(mov.type, mov.referenceType)
                const badgeVariant = getMovementBadgeVariant(mov.type, isManualAdjustment(mov.referenceType))

                return (
                  <TableRow key={mov.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(mov.createdAt), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="text-foreground">{mov.product.name}</div>
                      <div className="text-xs text-muted-foreground font-normal">{mov.product.code}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant} className="text-[10px] px-2 py-0.5">
                        {typeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : '-'}{Math.abs(Number(mov.quantity))} <span className="text-xs font-normal opacity-70">{mov.product.unit.code}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{mov.location.code}</div>
                      <div className="text-xs text-muted-foreground">{mov.location.warehouse.name}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {mov.documentNumber || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {mov.performedBy.name.split(' ')[0]}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/movements/${mov.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {skip + 1} a {Math.min(skip + pageSize, totalCount)} de {totalCount} resultados
            </div>
            <div className="flex gap-2">
              {(() => {
                const buildQuery = (p: number) => {
                  const q = new URLSearchParams()
                  for (const [key, value] of Object.entries(searchParams)) {
                    if (typeof value === 'string') q.set(key, value)
                  }
                  q.set('page', String(p))
                  return q.toString()
                }
                return (
                  <>
                    {page > 1 ? (
                      <Link href={`/movements?${buildQuery(page - 1)}`}>
                        <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2"/> Anterior</Button>
                      </Link>
                    ) : (
                      <Button variant="outline" size="sm" disabled><ArrowLeft className="h-4 w-4 mr-2"/> Anterior</Button>
                    )}
                    {page < totalPages ? (
                      <Link href={`/movements?${buildQuery(page + 1)}`}>
                        <Button variant="outline" size="sm">Próxima <ArrowRight className="h-4 w-4 ml-2"/></Button>
                      </Link>
                    ) : (
                      <Button variant="outline" size="sm" disabled>Próxima <ArrowRight className="h-4 w-4 ml-2"/></Button>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
