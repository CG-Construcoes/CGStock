import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart3 } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { warehouseIdFilter } from "@/lib/dal"

export default async function ConsumptionReportPage() {
  await requirePermissionPage('REPORT_VIEW')
  const wFilter = await warehouseIdFilter((await getValidatedSession())!.userId)
  const where = wFilter ? { request: wFilter } : {}

  // Agrega a quantidade total entregue agrupada por produto
  const consumption = await db.materialRequestItem.groupBy({
    by: ['productId'],
    where,
    _sum: {
      deliveredQuantity: true,
    },
    orderBy: {
      _sum: {
        deliveredQuantity: 'desc'
      }
    },
    take: 50
  })

  // Como o groupBy retorna apenas o ID, precisamos buscar os dados do produto para enriquecer a tabela
  const productIds = consumption.map(c => c.productId)
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { unit: true, category: true }
  })

  // Merge dos dados
  const enrichedData = consumption.map(c => ({
    ...c,
    product: products.find(p => p.id === c.productId)
  })).filter(c => c.product && Number(c._sum.deliveredQuantity) && Number(c._sum.deliveredQuantity) > 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-emerald-600" />
            Ranking de Consumo (Curva ABC)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Produtos mais requisitados e entregues na operação.</p>
        </div>
        </div>
      </div>

      <div className="bg-card  rounded-md border border-border shadow-sm  overflow-hidden  ">
        {enrichedData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum consumo registrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cód. Insumo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Total Consumido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedData.map((item, index) => (
                  <TableRow key={item.productId}>
                    <TableCell className="font-bold text-muted-foreground">
                      #{index + 1}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {item.product?.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.product?.code}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.product?.category?.name}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 text-lg">
                      {Number(item._sum.deliveredQuantity)} <span className="text-xs text-muted-foreground font-normal">{item.product?.unit?.code}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
