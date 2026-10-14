import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import {  Save } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { warehouseIdFilter, warehouseScopeIds } from "@/lib/dal"
import { createLocationAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function NewLocationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requirePermissionPage('CONFIG_MANAGE')
  const resolvedSearchParams = await searchParams;
  const scope = await warehouseScopeIds()
  const warehouses = await db.warehouse.findMany({ where: { status: 'ACTIVE', id: { in: scope ?? undefined } } })
  const parentLocations = await db.warehouseLocation.findMany({ where: { status: 'ACTIVE', ...await warehouseIdFilter() }, include: { warehouse: true } })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Localização</h2>
          <p className="text-muted-foreground">Crie uma nova área de armazenamento físico no almoxarifado.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {resolvedSearchParams.error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {resolvedSearchParams.error}
            </div>
          )}

          <form action={createLocationAction} className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Almoxarifado</label>
                  <Select name="warehouseId" required>
                    <option value="">Selecione...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Localização Pai (Opcional)</label>
                  <Select name="parentId">
                    <option value="">Nenhuma (Raiz)</option>
                    {parentLocations.map(l => (
                      <option key={l.id} value={l.id}>[{l.warehouse.code}] {l.code} - {l.name}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">Deve pertencer ao mesmo almoxarifado escolhido acima.</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código / Posição</label>
                  <Input name="code" placeholder="Ex: A01, COR-B" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input name="name" placeholder="Ex: Prateleira 1, Corredor B" required />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Descrição (Opcional)</label>
                  <Input name="description" placeholder="Mais detalhes sobre a localização" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/locations">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Localização
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
