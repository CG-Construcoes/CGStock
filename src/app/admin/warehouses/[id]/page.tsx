import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BackButton } from "@/components/ui/back-button"
import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import { notFound } from "next/navigation"
import { EditWarehouseForm } from "./edit-warehouse-form"
import { WarehouseDeleteDialog } from "../warehouse-delete-dialog"
import { WarehouseLocationsManager } from "../warehouse-locations-manager"
import { requirePermissionPage, hasPermission } from "@/lib/permissions"
import { isBusinessCenterCode } from "@/lib/business-center"

export default async function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage('CONFIG_MANAGE')
  const canCreateLocation = await hasPermission('LOCATION_CREATE')
  const { id } = await params
  
  const scope = await warehouseScopeIds()
  const warehouse = await db.warehouse.findFirst({
    where: { id: { equals: id, in: scope ?? undefined } },
    include: {
      locations: {
        include: {
          _count: {
            select: { stocks: true, products: true }
          }
        },
        orderBy: { code: 'asc' }
      }
    }
  })

  if (!warehouse) notFound()

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Editar Almoxarifado</h2>
            <p className="text-muted-foreground">{warehouse.name}</p>
          </div>
        </div>
        
        <WarehouseDeleteDialog
          warehouseId={warehouse.id}
          warehouseName={warehouse.name}
          warehouseCode={warehouse.code}
          redirectAfterDelete={true}
        />
      </div>

      <Card className="border border-border shadow-xs">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg">Dados do Almoxarifado</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {(!isBusinessCenterCode(warehouse.code) || !warehouse.engineerName || !warehouse.engineerEmail) && (
            <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-sm">
              Cadastro incompleto: {!isBusinessCenterCode(warehouse.code) ? "o código precisa estar no formato do Informakon (AAA.BB.CCCC)" : "falta o engenheiro responsável"}. Atualize para salvar.
            </div>
          )}
          <EditWarehouseForm warehouse={warehouse} />
        </CardContent>
      </Card>

      {/* Seção de Gerenciamento das Localizações Físicas deste Almoxarifado */}
      <WarehouseLocationsManager
        warehouseId={warehouse.id}
        warehouseName={warehouse.name}
        warehouseCode={warehouse.code}
        locations={warehouse.locations}
        canCreate={canCreateLocation}
      />
    </div>
  )
}
