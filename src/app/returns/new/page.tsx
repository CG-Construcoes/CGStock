import { db } from "@/lib/db"
import { warehouseIdFilter, warehouseScopeIds } from "@/lib/dal"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {  Save } from "lucide-react"
import Link from "next/link"
import { createReturnAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"
import { ReturnItemsForm } from "./return-items-form"
import { requirePermissionPage } from "@/lib/permissions"

export default async function NewReturnPage() {
  await requirePermissionPage('STOCK_ENTRY')
  const scope = await warehouseScopeIds()
  const [warehouses, products, requests] = await Promise.all([
    db.warehouse.findMany({
      where: { status: 'ACTIVE', id: { in: scope ?? undefined } },
      include: { locations: true }
    }),
    db.product.findMany({
      where: { status: 'ACTIVE' },
      include: { unit: true }
    }),
    db.materialRequest.findMany({
      where: { status: { in: ['FULFILLED', 'PARTIALLY_FULFILLED'] }, ...await warehouseIdFilter() }
    })
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Devolução</h2>
          <p className="text-muted-foreground">Registre o retorno de materiais ao estoque.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form action={createReturnAction} className="space-y-8">
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Informações da Devolução</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Almoxarifado de Destino</label>
                  <Select name="warehouseId" required>
                    <option value="">Selecione...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Requisição Original (Opcional)</label>
                  <Select name="requestId">
                    <option value="">Nenhuma (Devolução Avulsa)</option>
                    {requests.map(r => (
                      <option key={r.id} value={r.id}>{r.requestNumber}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Motivo</label>
                  <Input name="reason" placeholder="Ex: Sobrou da obra X" required />
                </div>
              </div>
            </div>

            <ReturnItemsForm products={products} warehouses={warehouses} />

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Link href="/returns">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
                <Save className="h-4 w-4" />
                Receber Devolução
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
