import { db } from "@/lib/db"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { format } from "date-fns"
import { BackButton } from "@/components/ui/back-button"
import { WarehouseSelectFilter } from "@/components/ui/warehouse-select-filter"
import { resolveWarehouseContext } from "@/lib/dal"
import { getValidatedSession } from "@/lib/auth"
import { getMovementTypeLabel, getMovementBadgeVariant, isManualAdjustment, isInMovement } from "@/lib/movement-labels"
import { Prisma } from "@prisma/client"
import { Suspense } from "react"

export interface MovementsReportTemplateProps {
  page: number;
  title: string;
  description: string;
  icon: React.ElementType;
  typeFilter?: Prisma.StockMovementWhereInput["type"];
  basePath: string;
  warehouseId?: string;
}

export async function MovementsReportTemplate({
  page,
  title,
  description,
  icon: Icon,
  typeFilter,
  basePath,
  warehouseId,
}: MovementsReportTemplateProps) {
  const pageSize = 50
  
  const session = await getValidatedSession()
  if (!session) return null
  const { warehouses, selectedWarehouseId, warehouseWhere: wFilter } = await resolveWarehouseContext(warehouseId, session.userId)
  
  const whereClause: Prisma.StockMovementWhereInput = {
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(wFilter ? wFilter : {})
  }

  const movements = await db.stockMovement.findMany({
    where: whereClause,
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: { createdAt: 'desc' },
    include: {
      product: { include: { unit: true } },
      warehouse: true,
      location: true,
      performedBy: true
    }
  })

  const total = await db.stockMovement.count({ where: whereClause })
  const totalPages = Math.ceil(total / pageSize)

  const getTypeLabel = (type: string, referenceType?: string | null): { label: string; color: BadgeProps["variant"] } => {
    return {
      label: getMovementTypeLabel(type, referenceType),
      color: getMovementBadgeVariant(type, isManualAdjustment(referenceType)),
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Icon className="h-6 w-6 text-emerald-600" />
              {title}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{description}</p>
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

      <div className="bg-card  rounded-md border border-border shadow-sm  overflow-hidden  ">
        {movements.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhuma movimentação registrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Origem/Destino</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((mov) => {
                  const t = getTypeLabel(mov.type, mov.referenceType)
                  const isPositive = isInMovement(mov.type)

                  return (
                    <TableRow key={mov.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(mov.createdAt, "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.color} className="text-[10px] uppercase">
                          {t.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {mov.product.code} - {mov.product.name}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : '-'}{Math.abs(Number(mov.quantity))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{mov.warehouse.name}</TableCell>
                      <TableCell className="text-xs font-mono bg-muted">{mov.location.code}</TableCell>
                      <TableCell className="text-xs text-primary cursor-pointer hover:underline">
                        {mov.documentNumber || mov.referenceId || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{mov.performedBy.name.split(' ')[0]}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <a href={`${basePath}?page=${Math.max(1, page - 1)}`} className={`px-4 py-2 border rounded-md ${page === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}>
            Anterior
          </a>
          <span className="px-4 py-2 text-muted-foreground">Página {page} de {totalPages}</span>
          <a href={`${basePath}?page=${Math.min(totalPages, page + 1)}`} className={`px-4 py-2 border rounded-md ${page === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}>
            Próxima
          </a>
        </div>
      )}
    </div>
  )
}
