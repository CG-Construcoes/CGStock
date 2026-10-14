import { db } from "@/lib/db"
import { warehouseIdFilter } from "@/lib/dal"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertTriangle, Eye, Filter } from "lucide-react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BackButton } from "@/components/ui/back-button"
import { concludeInventoryAction, recalculatePartialInventoryAction } from "../../actions"
import { requireAnyPermissionPage } from "@/lib/permissions"

export default async function DivergencesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyPermissionPage('INVENTORY_REVIEW', 'INVENTORY_APPROVE', 'INVENTORY_CREATE')
  const { id } = await params
  
  const inv = await db.inventory.findFirst({
    where: { id, ...await warehouseIdFilter() },
    include: {
      divergences: {
        include: {
          product: true,
          location: true
        }
      }
    }
  })

  if (!inv) notFound()

  const totalDivergences = inv.divergences.length
  const withSurplus = inv.divergences.filter(d => Number(d.difference) > 0).length
  const withShortage = inv.divergences.filter(d => Number(d.difference) < 0).length
  const uncollectedDivergences = inv.divergences.filter(d => Number(d.countedQuantity) === 0 && d.status === 'PENDING').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Divergências Encontradas</h2>
            <p className="text-muted-foreground">Resultado da conferência entre sistema e contagem física.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {uncollectedDivergences > 0 && (
            <form action={recalculatePartialInventoryAction}>
              <input type="hidden" name="id" value={inv.id} />
              <Button variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Manter Apenas Itens Coletados (Ignorar {uncollectedDivergences} não bipados)
              </Button>
            </form>
          )}
          {inv.status !== 'COMPLETED' && (
            <form action={concludeInventoryAction}>
              <input type="hidden" name="id" value={inv.id} />
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Concluir Inventário
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Total de Divergências</div>
            <div className="text-3xl font-bold text-foreground">{totalDivergences}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Sobra Física (+)</div>
            <div className="text-3xl font-bold text-emerald-600">{withSurplus}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Falta Física (-)</div>
            <div className="text-3xl font-bold text-red-600">{withShortage}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Local</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-center">Sistema</TableHead>
              <TableHead className="text-center">Contado</TableHead>
              <TableHead className="text-center">Diferença</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inv.divergences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                  Nenhuma divergência! O estoque físico bate perfeitamente com o sistema.
                </TableCell>
              </TableRow>
            ) : (
              inv.divergences.map(div => {
                const diffColor = Number(div.difference) > 0 ? 'text-emerald-600' : 'text-red-600'
                const diffSignal = Number(div.difference) > 0 ? '+' : ''
                const detailHref = `/inventory/${inv.id}/divergences/${div.id}`
                
                return (
                  <TableRow key={div.id} className="group hover:bg-muted/30">
                    <TableCell className="font-medium">{div.location.code}</TableCell>
                    <TableCell>
                      <Link href={detailHref} className="block group-hover:text-primary transition-colors">
                        <div className="font-medium group-hover:text-primary">{div.product.code}</div>
                        <div className="text-xs text-muted-foreground">{div.product.name}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{Number(div.systemQuantity)}</TableCell>
                    <TableCell className="text-center font-bold text-foreground">{Number(div.countedQuantity)}</TableCell>
                    <TableCell className={`text-center font-bold ${diffColor}`}>
                      {diffSignal}{Number(div.difference)}
                    </TableCell>
                    <TableCell>
                      {div.status === 'PENDING' ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                      ) : div.status === 'REVIEWED' ? (
                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                          Revisado
                        </Badge>
                      ) : div.status === 'APPROVED' || div.status === 'ADJUSTED' ? (
                        <Badge variant="success">Aprovado</Badge>
                      ) : (
                        <Badge variant="destructive">Rejeitado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={detailHref}>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 hover:border-primary hover:text-primary">
                          <Eye className="h-3.5 w-3.5" />
                          Analisar
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
