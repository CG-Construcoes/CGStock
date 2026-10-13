import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Save } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { warehouseIdFilter } from "@/lib/dal"
import { updateProductAction } from "../../actions"
import { BackButton } from "@/components/ui/back-button"
import { notFound } from "next/navigation"
import { requirePermissionPage } from "@/lib/permissions"

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage('PRODUCT_UPDATE')
  const { id } = await params
  
  const product = await db.product.findUnique({
    where: { id }
  })
  
  if (!product) notFound()

  const categories = await db.productCategory.findMany({ where: { status: 'ACTIVE' } })
  const units = await db.productUnit.findMany({ where: { status: 'ACTIVE' } })
  const locations = await db.warehouseLocation.findMany({ where: { status: 'ACTIVE', ...await warehouseIdFilter() }, include: { warehouse: true } })

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Editar Produto</h2>
          <p className="text-muted-foreground">Altere as informações do produto.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <form action={updateProductAction} className="space-y-6">
            <input type="hidden" name="id" value={product.id} />
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Informações Básicas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Cód. Insumo</label>
                  <Input name="code" defaultValue={product.code} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código de Barras</label>
                  <Input name="barcode" defaultValue={product.barcode || ""} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Descrição Completa</label>
                  <Input name="name" defaultValue={product.name} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição Curta</label>
                  <Input name="shortDescription" defaultValue={product.shortDescription || ""} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria</label>
                  <Select name="categoryId" defaultValue={product.categoryId} required>
                    <option value="">Selecione...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select name="status" defaultValue={product.status}>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Controle e Estoque</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unidade de Medida</label>
                  <Select name="unitId" defaultValue={product.unitId} required>
                    <option value="">Selecione...</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estoque Mínimo</label>
                  <Input name="minimumStock" type="number" defaultValue={product.minimumStock} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estoque Máximo</label>
                  <Input name="maximumStock" type="number" defaultValue={product.maximumStock} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Marca</label>
                  <Input name="brand" defaultValue={product.brand || ""} placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Modelo</label>
                  <Input name="model" defaultValue={product.model || ""} placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Localização Padrão</label>
                  <Select name="defaultLocationId" defaultValue={product.defaultLocationId || ""}>
                    <option value="">Selecione...</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.warehouse.code} - {l.code}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href={`/products/${product.id}`}>
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
