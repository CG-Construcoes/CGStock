import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import {  Save } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { warehouseIdFilter, warehouseScopeIds } from "@/lib/dal"
import { redirect } from "next/navigation"
import { updateLocationAction } from "../../actions"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function EditLocationPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  await requirePermissionPage('CONFIG_MANAGE')
  const params = await props.params;
  const searchParams = await props.searchParams;

  const location = await db.warehouseLocation.findFirst({
    where: { id: params.id, ...await warehouseIdFilter() }
  })

  if (!location) {
    redirect("/locations")
  }

  const scope = await warehouseScopeIds()
  const warehouses = await db.warehouse.findMany({ where: { status: 'ACTIVE', id: { in: scope ?? undefined } } })
  // Não podemos definir como pai de si mesmo nem de um filho indireto (validação na action)
  const parentLocations = await db.warehouseLocation.findMany({ 
    where: { status: 'ACTIVE', id: { not: location.id }, ...await warehouseIdFilter() },
    include: { warehouse: true } 
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Editar Localização</h2>
          <p className="text-muted-foreground">Altere os dados, reorganize a hierarquia ou inative a localização.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {searchParams.error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {searchParams.error}
            </div>
          )}

          <form action={updateLocationAction} className="space-y-6">
            <input type="hidden" name="id" value={location.id} />
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Almoxarifado</label>
                  <Select name="warehouseId" defaultValue={location.warehouseId} required>
                    <option value="">Selecione...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Localização Pai (Opcional)</label>
                  <Select name="parentId" defaultValue={location.parentId || ''}>
                    <option value="">Nenhuma (Raiz)</option>
                    {parentLocations.map(l => (
                      <option key={l.id} value={l.id}>[{l.warehouse.code}] {l.code} - {l.name}</option>
                    ))}
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código / Posição</label>
                  <Input name="code" defaultValue={location.code} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input name="name" defaultValue={location.name} required />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição (Opcional)</label>
                  <Input name="description" defaultValue={location.description || ''} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select name="status" defaultValue={location.status}>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/locations">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
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
