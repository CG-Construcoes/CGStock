import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {  Save } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { warehouseIdFilter } from "@/lib/dal"
import { createProductAction } from "../actions"
import { BarcodeInput } from "./barcode-input"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function NewProductPage() {
  await requirePermissionPage('PRODUCT_CREATE')
  const categories = await db.productCategory.findMany({ where: { status: 'ACTIVE' } })
  const units = await db.productUnit.findMany({ where: { status: 'ACTIVE' } })
  const locations = await db.warehouseLocation.findMany({ where: { status: 'ACTIVE', ...await warehouseIdFilter() }, include: { warehouse: true } })

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Novo Produto</h2>
          <p className="text-muted-foreground">Adicione um novo produto ao catálogo do almoxarifado.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <form action={createProductAction} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Informações Básicas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Cód. Insumo</label>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">Automático</span>
                  </div>
                  <Input name="code" placeholder="Deixe em branco para gerar automático" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código de Barras</label>
                  <BarcodeInput />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Descrição Completa</label>
                  <Input name="name" placeholder="Descrição detalhada do produto" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição Curta</label>
                  <Input name="shortDescription" placeholder="Nome reduzido" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria</label>
                  <Select name="categoryId" required>
                    <option value="">Selecione...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Controle e Estoque</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unidade de Medida</label>
                  <Select name="unitId" required>
                    <option value="">Selecione...</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estoque Mínimo</label>
                  <Input name="minimumStock" type="number" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estoque Máximo</label>
                  <Input name="maximumStock" type="number" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Marca</label>
                  <Input name="brand" placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Modelo</label>
                  <Input name="model" placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Localização Padrão</label>
                  <Select name="defaultLocationId">
                    <option value="">Selecione...</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.warehouse.code} - {l.code}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/products">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Produto
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
