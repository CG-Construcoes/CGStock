import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import { requireAnyPermissionPage, hasPermission } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { WarehouseLocationsManager } from "@/app/admin/warehouses/warehouse-locations-manager"

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyPermissionPage('STOCK_VIEW', 'STOCK_ENTRY', 'STOCK_TRANSFER')
  const session = await getValidatedSession()
  const canManage = session?.roles?.includes('ADMIN') || (await hasPermission('CONFIG_MANAGE'))
  const canCreateLocation = await hasPermission('LOCATION_CREATE')
  const resolvedParams = await params

  const scope = await warehouseScopeIds(session!.userId)
  const warehouse = await db.warehouse.findFirst({
    where: { id: { equals: resolvedParams.id, in: scope ?? undefined } },
    include: {
      locations: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { stocks: true, products: true } } }
      }
    }
  })

  if (!warehouse) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{warehouse.name}</h2>
            <p className="text-muted-foreground">Código: {warehouse.code}</p>
          </div>
        </div>
        {canManage && (
          <Link href={`/admin/warehouses/${warehouse.id}`}>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Editar / Gerenciar
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={warehouse.status === 'ACTIVE' ? 'success' : 'secondary'}>{warehouse.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descrição:</span>
              <span>{warehouse.description || '-'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gerenciamento das localizações: criação liberada por LOCATION_CREATE; exclusão exige CONFIG_MANAGE */}
      <WarehouseLocationsManager
        warehouseId={warehouse.id}
        warehouseName={warehouse.name}
        warehouseCode={warehouse.code}
        locations={warehouse.locations}
        canCreate={canCreateLocation}
        canDelete={canManage}
      />
    </div>
  )
}
