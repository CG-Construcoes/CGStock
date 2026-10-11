import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"
import { Save, Trash2 } from "lucide-react"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { updateSupplierAction, deleteSupplierAction } from "../actions"
import { requirePermissionPage } from "@/lib/permissions"

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage('CONFIG_MANAGE')
  const { id } = await params
  
  const supplier = await db.supplier.findUnique({
    where: { id }
  })

  if (!supplier) notFound()

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Editar Fornecedor</h2>
            <p className="text-muted-foreground">{supplier.name}</p>
          </div>
        </div>
        
        <form action={deleteSupplierAction}>
          <input type="hidden" name="id" value={supplier.id} />
          <Button variant="destructive" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Fornecedor</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSupplierAction} className="space-y-4">
            <input type="hidden" name="id" value={supplier.id} />
            
            <div className="space-y-2">
              <Label htmlFor="name">Razão Social / Nome</Label>
              <Input id="name" name="name" defaultValue={supplier.name} required />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tradeName">Nome Fantasia (Opcional)</Label>
              <Input id="tradeName" name="tradeName" defaultValue={supplier.tradeName || ""} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="document">CNPJ / CPF</Label>
                <Input id="document" name="document" defaultValue={supplier.document || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" defaultValue={supplier.phone || ""} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail de Contato</Label>
              <Input id="email" name="email" type="email" defaultValue={supplier.email || ""} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select 
                id="status" 
                name="status" 
                defaultValue={supplier.status}
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
