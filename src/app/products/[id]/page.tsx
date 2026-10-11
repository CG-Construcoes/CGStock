import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {  Edit, Package, Archive } from "lucide-react"
import Link from "next/link"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage('PRODUCT_VIEW')
  const { id } = await params
  
  const product = await db.product.findUnique({
    where: { id },
    include: {
      category: true,
      unit: true,
      defaultLocation: { include: { warehouse: true } },
      stocks: { include: { location: { include: { warehouse: true } } } },
      movements: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { location: true, performedBy: true }
      }
    }
  })

  if (!product) notFound()

  const totalQuantity = product.stocks.reduce((acc, stock) => acc + Number(stock.quantity), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">{product.name}</h2>
              <Badge variant={product.status === 'ACTIVE' ? 'success' : 'secondary'}>
                {product.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <p className="text-muted-foreground">Cód.Insumo: {product.code} {product.barcode ? `• Cód. Barras: ${product.barcode}` : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/stock/${product.id}`}>
            <Button variant="outline" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Ver Estoque
            </Button>
          </Link>
          <Button className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Editar Produto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Detalhes do Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Categoria</p>
                <p className="font-medium">{product.category.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unidade de Medida</p>
                <p className="font-medium">{product.unit.name} ({product.unit.code})</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marca</p>
                <p className="font-medium">{product.brand || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modelo</p>
                <p className="font-medium">{product.model || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Localização Padrão</p>
                <p className="font-medium">{product.defaultLocation ? `${product.defaultLocation.warehouse.name} - ${product.defaultLocation.code}` : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estoque Mín / Máx</p>
                <p className="font-medium">{product.minimumStock} / {product.maximumStock > 0 ? product.maximumStock : 'Não definido'}</p>
              </div>
            </div>
            {product.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">Observações</p>
                <p className="text-sm">{product.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg">Resumo de Estoque</CardTitle>
            <Package className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground mb-4">{totalQuantity}</div>
            
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-sm font-medium">Localizações (Top 3)</h4>
              {product.stocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem estoque</p>
              ) : (
                product.stocks.slice(0, 3).map(stock => (
                  <div key={stock.id} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{stock.location.code}</span>
                    <span className="font-medium">{Number(stock.quantity)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3 pt-4 border-t mt-4">
              <h4 className="text-sm font-medium">Últimas Movimentações</h4>
              {product.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem movimentações</p>
              ) : (
                product.movements.slice(0, 3).map(mov => (
                  <div key={mov.id} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground truncate max-w-[120px]" title={mov.type}>
                      {mov.type === 'ENTRY' ? 'Entrada' : mov.type === 'EXIT' ? 'Saída' : mov.type}
                    </span>
                    <span className={`font-medium ${Number(mov.quantity) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {Number(mov.quantity) > 0 ? '+' : ''}{Number(mov.quantity)}
                    </span>
                  </div>
                ))
              )}
            </div>
            
            <div className="pt-4 border-t mt-4 text-center">
              <Link href={`/movements?productId=${product.id}`}>
                <Button variant="link" className="text-primary hover:text-primary/80">
                  Ver Histórico Completo de Movimentações &rarr;
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
