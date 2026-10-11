import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"
import { Save } from "lucide-react"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { updateWarehouseAction } from "../actions"
import { WarehouseDeleteDialog } from "../warehouse-delete-dialog"
import { WarehouseLocationsManager } from "../warehouse-locations-manager"
import { requirePermissionPage } from "@/lib/permissions"

export default async function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage('CONFIG_MANAGE')
  const { id } = await params
  
  const warehouse = await db.warehouse.findUnique({
    where: { id },
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
        <CardContent className="pt-6">
          <form action={updateWarehouseAction} className="space-y-4">
            <input type="hidden" name="id" value={warehouse.id} />
            
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Almoxarifado *</Label>
              <Input id="name" name="name" defaultValue={warehouse.name} required />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="code">Código Identificador *</Label>
              <Input id="code" name="code" defaultValue={warehouse.code} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (Opcional)</Label>
              <Input id="description" name="description" defaultValue={warehouse.description || ""} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status Operacional</Label>
              <select 
                id="status" 
                name="status" 
                defaultValue={warehouse.status}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-border">
              <BackButton />
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Seção de Gerenciamento das Localizações Físicas deste Almoxarifado */}
      <WarehouseLocationsManager
        warehouseId={warehouse.id}
        warehouseName={warehouse.name}
        warehouseCode={warehouse.code}
        locations={warehouse.locations}
      />
    </div>
  )
}
