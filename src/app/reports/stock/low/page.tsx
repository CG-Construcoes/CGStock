import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { warehouseIdFilter } from "@/lib/dal"

export default async function LowStockReportPage() {
  await requirePermissionPage('REPORT_VIEW')
  const wFilter = await warehouseIdFilter((await getValidatedSession())!.userId)

  const stocks = await db.stock.findMany({
    where: wFilter,
    orderBy: [{ product: { name: 'asc' } }],
    include: {
      product: {
        include: { category: true, unit: true }
      },
      warehouse: true,
      location: true
    }
  })

  const lowStocks = stocks.filter(s => Number(s.quantity) <= s.product.minimumStock)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Produtos em Baixo Estoque
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Itens que atingiram o limite mínimo ou estão zerados.</p>
        </div>
        </div>
      </div>

      <div className="bg-card  rounded-md border border-border shadow-sm  overflow-hidden  ">
        {lowStocks.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum produto em baixo estoque no momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cód. Insumo</TableHead>
                  <TableHead>Almoxarifado</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead className="text-right">Qtd Atual</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStocks.map((stock) => {
                  let status = 'LOW'
                  if (Number(stock.quantity) <= 0) status = 'OUT_OF_STOCK'

                  return (
                    <TableRow key={stock.id}>
                      <TableCell className="font-medium text-foreground">{stock.product.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{stock.product.code}</TableCell>
                      <TableCell className="text-sm">{stock.warehouse.name}</TableCell>
                      <TableCell className="text-sm font-mono bg-muted">{stock.location.code}</TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {Number(stock.quantity)} <span className="text-xs text-muted-foreground font-normal">{stock.product.unit.code}</span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{stock.product.minimumStock}</TableCell>
                      <TableCell className="text-center">
                        {status === 'LOW' && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Baixo</Badge>}
                        {status === 'OUT_OF_STOCK' && <Badge variant="destructive">Zerado</Badge>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
