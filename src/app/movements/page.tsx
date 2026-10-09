import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Eye, ArrowRight, ArrowLeft } from "lucide-react"
import { db } from "@/lib/db"
import Link from "next/link"
import { Prisma } from "@prisma/client"
import { MovementsFilterForm } from "./filter-form"
import { format } from "date-fns"

export default async function MovementsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams.page) || 1
  const pageSize = 20
  const skip = (page - 1) * pageSize

  // Build filter query
  const where: Prisma.StockMovementWhereInput = {}
  
  const typeParam = searchParams.type as string
  if (typeParam) where.type = typeParam

  const productParam = searchParams.productId as string
  if (productParam) where.productId = productParam

  const warehouseParam = searchParams.warehouseId as string
  if (warehouseParam) where.warehouseId = warehouseParam

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

  const [movements, totalCount, products, warehouses] = await Promise.all([
    db.stockMovement.findMany({
      where,
      include: {
        product: { include: { unit: true } },
        location: { include: { warehouse: true } },
        performedBy: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    }),
    db.stockMovement.count({ where }),
    db.product.findMany({ select: { id: true, code: true, name: true }, orderBy: { name: 'asc' } }),
    db.warehouse.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
  ])

  const totalPages = Math.ceil(totalCount / pageSize)

  // Calculate summary if only 1 product is selected
  let summary = null
  if (productParam) {
    const agg = await db.stockMovement.groupBy({
      by: ['type'],
      where,
      _sum: { quantity: true }
    })
    
    let totalIn = 0
    let totalOut = 0
    agg.forEach(a => {
      const q = Number(a._sum.quantity || 0)
      if (['ENTRY', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'RETURN'].includes(a.type)) totalIn += q
      if (['EXIT', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'].includes(a.type)) totalOut += q
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
          warehouseId: warehouseParam || "",
          referenceType: refTypeParam || ""
        }} 
      />

      <div className="bg-card  rounded-md border border-[#5C3310]/50 shadow-sm  overflow-hidden  ">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-[#5C3310]/50">
          {movements.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhuma movimentação registrada para este filtro.
            </div>
          ) : (
            movements.map((mov) => {
              const isPositive = ['ENTRY', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'RETURN'].includes(mov.type)
              let badgeVariant = 'secondary'
              let typeLabel = mov.type
              
              if (mov.type === 'ENTRY') { badgeVariant = 'success'; typeLabel = 'Entrada' }
              if (mov.type === 'EXIT') { badgeVariant = 'destructive'; typeLabel = 'Saída' }
              if (mov.type === 'ADJUSTMENT_IN') { badgeVariant = 'outline'; typeLabel = 'Ajuste (+)' }
              if (mov.type === 'ADJUSTMENT_OUT') { badgeVariant = 'outline'; typeLabel = 'Ajuste (-)' }
              if (mov.type === 'TRANSFER_IN') { badgeVariant = 'secondary'; typeLabel = 'Transf. (+)' }
              if (mov.type === 'TRANSFER_OUT') { badgeVariant = 'secondary'; typeLabel = 'Transf. (-)' }
              if (mov.type === 'RETURN') { badgeVariant = 'default'; typeLabel = 'Devolução' }
              
              return (
                <div key={mov.id} className="p-4 space-y-3 hover:bg-muted/30 ">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">{mov.product.code}</span>
                      <span className="font-bold text-base text-foreground leading-tight">
                        {mov.product.name}
                      </span>
                    </div>
                    {/* @ts-expect-error: variant string literal mismatch */}
                    <Badge variant={badgeVariant} className="text-[10px] px-2 py-0.5">
                      {typeLabel}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Qtd</span>
                      <span className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : '-'}{mov.quantity} <span className="text-xs font-normal opacity-70">{mov.product.unit.code}</span>
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
                const isPositive = ['ENTRY', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'RETURN'].includes(mov.type)
                
                let badgeVariant = 'secondary'
                let typeLabel = mov.type
                
                if (mov.type === 'ENTRY') { badgeVariant = 'success'; typeLabel = 'Entrada' }
                if (mov.type === 'EXIT') { badgeVariant = 'destructive'; typeLabel = 'Saída' }
                if (mov.type === 'ADJUSTMENT_IN') { badgeVariant = 'outline'; typeLabel = 'Ajuste (+)' }
                if (mov.type === 'ADJUSTMENT_OUT') { badgeVariant = 'outline'; typeLabel = 'Ajuste (-)' }
                if (mov.type === 'TRANSFER_IN') { badgeVariant = 'secondary'; typeLabel = 'Transf. (+)' }
                if (mov.type === 'TRANSFER_OUT') { badgeVariant = 'secondary'; typeLabel = 'Transf. (-)' }
                if (mov.type === 'RETURN') { badgeVariant = 'default'; typeLabel = 'Devolução' }
                
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
                      {/* @ts-expect-error: variant string literal mismatch */}
                      <Badge variant={badgeVariant} className="text-[10px] px-2 py-0.5">
                        {typeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : '-'}{mov.quantity} <span className="text-xs font-normal opacity-70">{mov.product.unit.code}</span>
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
