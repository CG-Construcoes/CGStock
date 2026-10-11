import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"
import { Save } from "lucide-react"
import { createWarehouseAction } from "../actions"
import { requirePermissionPage } from "@/lib/permissions"

export default async function NewWarehousePage() {
  await requirePermissionPage('CONFIG_MANAGE')
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Novo Almoxarifado</h2>
          <p className="text-muted-foreground">Cadastre um novo galpão ou unidade física.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Almoxarifado</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createWarehouseAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required placeholder="Ex: Almoxarifado Central" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input id="code" name="code" required placeholder="Ex: ALM-CEN" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (Opcional)</Label>
              <Input id="description" name="description" placeholder="Informações adicionais..." />
            </div>
            
            <input type="hidden" name="status" value="ACTIVE" />

            <div className="pt-4 flex justify-end gap-2">
              <BackButton />
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Almoxarifado
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
