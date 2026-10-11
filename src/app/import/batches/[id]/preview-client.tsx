"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BackButton } from "@/components/ui/back-button"
import { executeImportBatchAction } from "../../actions"
import { toast } from "sonner"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"

export function PreviewClient({ batch }: { batch: any }) {
  const router = useRouter()
  const [isExecuting, setIsExecuting] = useState(false)
  
  const pendingRows = batch.rows.filter((r: any) => r.status === 'PENDING')
  const successRows = batch.rows.filter((r: any) => r.status === 'SUCCESS')
  const errorRows = batch.rows.filter((r: any) => r.status === 'ERROR')

  const handleExecute = async () => {
    setIsExecuting(true)
    const result = await executeImportBatchAction(batch.id)
    setIsExecuting(false)
    
    if (result.success) {
      toast.success("Importação concluída com sucesso!")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao executar importação.")
      router.refresh()
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Revisar Importação</h2>
            <p className="text-muted-foreground">Verifique os dados antes de confirmar a entrada no estoque.</p>
          </div>
        </div>
        {batch.status === 'STAGING' && (
          <Button onClick={handleExecute} disabled={isExecuting || pendingRows.length === 0} className="min-w-32">
            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Confirmar Importação
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm text-muted-foreground">Almoxarifado Destino</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{batch.warehouse?.name || 'N/A'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm text-muted-foreground">Status do Lote</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={batch.status === 'COMPLETED' ? 'success' : (batch.status === 'STAGING' ? 'secondary' : 'destructive')}>
              {batch.status === 'COMPLETED' ? 'Concluído' : (batch.status === 'STAGING' ? 'Em Análise' : 'Cancelado')}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm text-muted-foreground">Total de Linhas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{batch.rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm text-muted-foreground">Criado por</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold truncate">{batch.createdBy?.name || 'Sistema'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle>Linhas da Planilha</CardTitle>
          <div className="flex gap-2 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground"><div className="w-2 h-2 rounded-full bg-slate-300"/> Pendentes ({pendingRows.length})</span>
            <span className="flex items-center gap-1 text-success"><div className="w-2 h-2 rounded-full bg-success"/> Sucesso ({successRows.length})</span>
            <span className="flex items-center gap-1 text-destructive"><div className="w-2 h-2 rounded-full bg-destructive"/> Erro ({errorRows.length})</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Custo Un.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.productCode}</TableCell>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell className="text-right">{Number(row.quantity)}</TableCell>
                    <TableCell className="text-right">{row.unitCost ? `R$ ${Number(row.unitCost).toFixed(2)}` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'SUCCESS' ? 'success' : (row.status === 'ERROR' ? 'destructive' : 'outline')} className="text-[10px]">
                        {row.status === 'SUCCESS' ? 'Ok' : (row.status === 'ERROR' ? 'Erro' : 'Pendente')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={row.errorMessage || ''}>
                      {row.errorMessage || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
