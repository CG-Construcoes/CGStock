import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {  Plus, PackageX, ArrowRightLeft } from "lucide-react"
import Link from "next/link"
import { createTransferAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function NewTransferPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requirePermissionPage('STOCK_TRANSFER')
  const resolvedParams = await searchParams
  const error = resolvedParams?.error
  const scope = await warehouseScopeIds()
  const warehouses = await db.warehouse.findMany({ 
    where: { status: 'ACTIVE', id: { in: scope ?? undefined } },
    include: { locations: true }
  })
  
  const products = await db.product.findMany({ 
    where: { status: 'ACTIVE' },
    include: { unit: true }
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Transferência</h2>
          <p className="text-muted-foreground">Mova materiais entre diferentes localizações ou estoques.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3   slide-in-">
              <PackageX className="h-5 w-5 text-red-600" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}
          <form action={createTransferAction} className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Informações da Rota</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-amber-600">Localização de Origem *</label>
                  <Select name="sourceLocationId" required>
                    <option value="">Selecione de onde vai sair...</option>
                    {warehouses.flatMap(w => w.locations).map(l => (
                      <option key={l.id} value={l.id}>{l.code}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-emerald-600">Localização de Destino *</label>
                  <Select name="destinationLocationId" required>
                    <option value="">Selecione para onde vai...</option>
                    {warehouses.flatMap(w => w.locations).map(l => (
                      <option key={l.id} value={l.id}>{l.code}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2 flex items-center justify-between">
                Itens a Transferir
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1">
                  <Plus className="h-4 w-4" /> Adicionar Item
                </Button>
              </h3>
              
              <div className="border rounded-lg p-4 bg-muted flex items-start gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Produto</label>
                    <Select name="productId" required>
                      <option value="">Selecione...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Quantidade a mover</label>
                    <Input type="number" step="0.0001" name="quantity" defaultValue={1} min={0.0001} required />
                  </div>
                  <input type="hidden" name="unitId" value={products[0]?.unitId || ''} />
                </div>
                <Button type="button" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6">
                  <PackageX className="h-5 w-5" />
                </Button>
              </div>

            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Link href="/transfers">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Executar Transferência
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
