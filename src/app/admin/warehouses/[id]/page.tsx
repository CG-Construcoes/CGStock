import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"
import { Save, Trash2 } from "lucide-react"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { updateWarehouseAction, deleteWarehouseAction } from "../actions"
import { requirePermissionPage } from "@/lib/permissions"

export default async function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage('CONFIG_MANAGE')
  const { id } = await params
  
  const warehouse = await db.warehouse.findUnique({
    where: { id }
  })

  if (!warehouse) notFound()

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Editar Almoxarifado</h2>
            <p className="text-muted-foreground">{warehouse.name}</p>
          </div>
        </div>
        
        <form action={deleteWarehouseAction}>
          <input type="hidden" name="id" value={warehouse.id} />
          <Button variant="destructive" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Almoxarifado</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateWarehouseAction} className="space-y-4">
            <input type="hidden" name="id" value={warehouse.id} />
            
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" defaultValue={warehouse.name} required />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input id="code" name="code" defaultValue={warehouse.code} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (Opcional)</Label>
              <Input id="description" name="description" defaultValue={warehouse.description || ""} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
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

            <div className="pt-4 flex justify-end gap-2">
              <BackButton />
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
