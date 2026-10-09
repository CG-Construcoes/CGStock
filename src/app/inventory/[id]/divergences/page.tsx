import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {  CheckCircle2, AlertTriangle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BackButton } from "@/components/ui/back-button"
import { concludeInventoryAction } from "../../actions"

export default async function DivergencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const inv = await db.inventory.findUnique({
    where: { id },
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
  const withSurplus = inv.divergences.filter(d => d.difference > 0).length
  const withShortage = inv.divergences.filter(d => d.difference < 0).length

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

      <div className="bg-card  rounded-md border border-border shadow-sm  overflow-hidden  ">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Local</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-center">Sistema</TableHead>
              <TableHead className="text-center">Contado</TableHead>
              <TableHead className="text-center">Diferença</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inv.divergences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                  Nenhuma divergência! O estoque físico bate perfeitamente com o sistema.
                </TableCell>
              </TableRow>
            ) : (
              inv.divergences.map(div => {
                const diffColor = div.difference > 0 ? 'text-emerald-600' : 'text-red-600'
                const diffSignal = div.difference > 0 ? '+' : ''
                
                return (
                  <TableRow key={div.id}>
                    <TableCell className="font-medium">{div.location.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{div.product.code}</div>
                      <div className="text-xs text-muted-foreground">{div.product.name}</div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{div.systemQuantity}</TableCell>
                    <TableCell className="text-center font-bold text-foreground">{div.countedQuantity}</TableCell>
                    <TableCell className={`text-center font-bold ${diffColor}`}>
                      {diffSignal}{div.difference}
                    </TableCell>
                    <TableCell>
                      {div.status === 'PENDING' ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{div.status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      
      {totalDivergences > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium mb-1">Ajuste de Estoque</p>
            <p>
              A função de ajuste automático está em desenvolvimento. Por enquanto, os ajustes devem ser realizados manualmente através da rotina de 
              <strong> Movimentações &gt; Entrada/Saída</strong> para garantir a precisão do estoque.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
