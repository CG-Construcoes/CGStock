"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BackButton } from "@/components/ui/back-button"
import { executeImportBatchAction } from "../../actions"
import { formatNumber, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { Loader2, CheckCircle2, Clock } from "lucide-react"

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "Calculando..."
  const rounded = Math.ceil(seconds)
  if (rounded <= 1) return "menos de 1s"
  if (rounded < 60) return `${rounded}s`
  const mins = Math.floor(rounded / 60)
  const secs = rounded % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export function PreviewClient({ batch }: { batch: any }) {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>(batch.rows)
  const [batchStatus, setBatchStatus] = useState<string>(batch.status)
  const [isExecuting, setIsExecuting] = useState(false)
  const [progress, setProgress] = useState<{
    processed: number
    total: number
    percentage: number
    estimatedSecondsRemaining: number | null
  } | null>(null)

  useEffect(() => {
    setRows(batch.rows)
    setBatchStatus(batch.status)
  }, [batch.rows, batch.status])

  const pendingRows = rows.filter((r: any) => r.status === 'PENDING')
  const successRows = rows.filter((r: any) => r.status === 'SUCCESS')
  const errorRows = rows.filter((r: any) => r.status === 'ERROR')

  const handleExecute = async () => {
    const toProcess = rows.filter((r: any) => r.status === 'PENDING')
    if (toProcess.length === 0) return

    setIsExecuting(true)
    const totalToProcess = toProcess.length
    const CHUNK_SIZE = 100
    const startTime = Date.now()
    let processedSoFar = 0
    let hasError = false

    setProgress({
      processed: 0,
      total: totalToProcess,
      percentage: 0,
      estimatedSecondsRemaining: null,
    })

    for (let i = 0; i < totalToProcess; i += CHUNK_SIZE) {
      const chunkIds = toProcess.slice(i, i + CHUNK_SIZE).map((r: any) => r.id)
      const result = await executeImportBatchAction(batch.id, chunkIds)

      if (!result.success) {
        hasError = true
        toast.error(result.error || "Erro ao executar importação.")
        break
      }

      if (result.rowResults && result.rowResults.length > 0) {
        const resultMap = new Map(result.rowResults.map((r: any) => [r.id, r]))
        setRows(prev =>
          prev.map(row => {
            const updated = resultMap.get(row.id)
            if (!updated) return row
            return {
              ...row,
              status: updated.status,
              errorMessage: updated.errorMessage ?? null,
              currentQty: updated.status === 'SUCCESS' ? row.targetQty : row.currentQty,
              diffQty: updated.status === 'SUCCESS' ? 0 : row.diffQty,
              isNewProduct: updated.status === 'SUCCESS' ? false : row.isNewProduct,
            }
          })
        )
      }

      processedSoFar = Math.min(i + chunkIds.length, totalToProcess)
      const elapsedSeconds = (Date.now() - startTime) / 1000
      const rate = processedSoFar / Math.max(elapsedSeconds, 0.1)
      const remainingItems = totalToProcess - processedSoFar
      const estimatedSecondsRemaining = remainingItems > 0 ? remainingItems / rate : 0
      const percentage = Math.round((processedSoFar / totalToProcess) * 100)

      setProgress({
        processed: processedSoFar,
        total: totalToProcess,
        percentage,
        estimatedSecondsRemaining,
      })

      if (result.completed) {
        setBatchStatus('COMPLETED')
      }
    }

    setIsExecuting(false)

    if (!hasError) {
      toast.success("Importação concluída com sucesso!")
    }
    router.refresh()
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
        {batchStatus === 'STAGING' && (
          <Button onClick={handleExecute} disabled={isExecuting || pendingRows.length === 0} className="min-w-44">
            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            {isExecuting && progress
              ? `Importando (${progress.percentage}%)`
              : "Confirmar Importação"}
          </Button>
        )}
      </div>

      {isExecuting && progress && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-4 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>
                  Processando linhas da importação ({formatNumber(progress.processed)} de {formatNumber(progress.total)})
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Tempo estimado:{" "}
                  <strong className="text-foreground">
                    {progress.estimatedSecondsRemaining !== null
                      ? formatDuration(progress.estimatedSecondsRemaining)
                      : "Calculando..."}
                  </strong>
                </span>
                <span className="font-bold text-sm text-primary">{progress.percentage}%</span>
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

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
            <Badge variant={batchStatus === 'COMPLETED' ? 'success' : (batchStatus === 'STAGING' ? 'secondary' : 'destructive')}>
              {batchStatus === 'COMPLETED' ? 'Concluído' : (batchStatus === 'STAGING' ? 'Em Análise' : 'Cancelado')}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm text-muted-foreground">Total de Linhas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{formatNumber(rows.length)}</p>
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
          <div className="flex gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground"><div className="w-2 h-2 rounded-full bg-slate-300"/> Pendentes ({formatNumber(pendingRows.length)})</span>
            <span className="flex items-center gap-1.5 text-success"><div className="w-2 h-2 rounded-full bg-success"/> Sucesso ({formatNumber(successRows.length)})</span>
            <span className="flex items-center gap-1.5 text-destructive"><div className="w-2 h-2 rounded-full bg-destructive"/> Erro ({formatNumber(errorRows.length)})</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">No Sistema</TableHead>
                  <TableHead className="text-right">Qtd. Planilha</TableHead>
                  <TableHead className="text-right">Ação / Ajuste</TableHead>
                  <TableHead className="text-right">Custo Un.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => {
                  const diff = row.diffQty ?? 0
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.productCode}</TableCell>
                      <TableCell>{row.productName}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.isNewProduct ? (
                          <span className="text-xs italic">Novo</span>
                        ) : (
                          formatNumber(row.currentQty ?? 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatNumber(row.quantity)}</TableCell>
                      <TableCell className="text-right">
                        {row.status === 'SUCCESS' ? (
                          <span className="text-xs text-muted-foreground">Sincronizado</span>
                        ) : diff > 0 ? (
                          <span className="text-xs font-medium text-emerald-500">
                            +{formatNumber(diff)}
                          </span>
                        ) : diff < 0 ? (
                          <span className="text-xs font-medium text-amber-500">
                            {formatNumber(diff)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Igual (0)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{row.unitCost ? formatCurrency(row.unitCost) : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'SUCCESS' ? 'success' : (row.status === 'ERROR' ? 'destructive' : 'outline')} className="text-[10px]">
                          {row.status === 'SUCCESS' ? 'Ok' : (row.status === 'ERROR' ? 'Erro' : 'Pendente')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={row.errorMessage || ''}>
                        {row.errorMessage || '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
