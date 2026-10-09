import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {  CheckCircle2, AlertTriangle, XCircle, ArrowRight } from "lucide-react"
import DivergenceForm from "./divergence-form"
import { BackButton } from "@/components/ui/back-button"

export default async function DivergenceDetailsPage({ params }: { params: Promise<{ id: string, divergenceId: string }> }) {
  const { id, divergenceId } = await params
  
  const div = await db.inventoryDivergence.findUnique({
    where: { id: divergenceId },
    include: {
      inventory: true,
      product: true,
      location: true,
      reviewedBy: true,
      approvedBy: true,
      rejectedBy: true
    }
  })

  if (!div || div.inventoryId !== id) notFound()

  const diffColor = div.difference > 0 ? 'text-emerald-600' : 'text-red-600'
  const diffSignal = div.difference > 0 ? '+' : ''
  const percentDiff = div.systemQuantity > 0 
    ? Math.round((Math.abs(div.difference) / div.systemQuantity) * 100) 
    : 100

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">Análise de Divergência</h2>
            <Badge variant="outline" className="uppercase">{div.status}</Badge>
          </div>
          <p className="text-muted-foreground">
            Inventário: {div.inventory.code} • Local: {div.location.code}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes da Contagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg border">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Produto</p>
                  <p className="font-bold text-lg">{div.product.code}</p>
                  <p className="text-sm">{div.product.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-card rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Sistema Esperava</p>
                  <p className="text-3xl font-bold text-muted-foreground">{div.systemQuantity}</p>
                </div>
                <div className="flex items-center justify-center text-gray-300">
                  <ArrowRight className="h-8 w-8" />
                </div>
                <div className="p-4 bg-card rounded-lg border shadow-sm border-primary/10">
                  <p className="text-sm text-primary font-medium mb-1">Total Contado</p>
                  <p className="text-3xl font-bold text-foreground">{div.countedQuantity}</p>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-gray-900 text-white rounded-lg">
                <span className="font-medium text-lg">Diferença Encontrada</span>
                <div className="text-right">
                  <span className={`text-3xl font-bold ${diffColor}`}>{diffSignal}{div.difference}</span>
                  <span className="text-muted-foreground text-sm ml-2">({percentDiff}%)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Auditoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before: before: before: before:">
                
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-primary/10 text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-md border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-foreground">Divergência Registrada</div>
                      <time className="font-mono text-xs text-muted-foreground">{new Date(div.createdAt).toLocaleDateString()}</time>
                    </div>
                    <div className="text-sm text-muted-foreground">Registrado automaticamente pelo sistema ao encerrar as coletas do inventário.</div>
                  </div>
                </div>

                {div.reviewedBy && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-md border bg-card shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-foreground">Revisado</div>
                        <time className="font-mono text-xs text-muted-foreground">{div.reviewedAt && new Date(div.reviewedAt).toLocaleDateString()}</time>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">Por: {div.reviewedBy.name}</div>
                      {div.reviewNotes && <div className="text-sm bg-muted p-2 rounded border">{div.reviewNotes}</div>}
                    </div>
                  </div>
                )}

                {div.approvedBy && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-emerald-100 text-emerald-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-md border bg-card shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-foreground">Aprovado e Ajustado</div>
                        <time className="font-mono text-xs text-muted-foreground">{div.approvedAt && new Date(div.approvedAt).toLocaleDateString()}</time>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">Por: {div.approvedBy.name}</div>
                      {div.approvalNotes && <div className="text-sm bg-muted p-2 rounded border">{div.approvalNotes}</div>}
                    </div>
                  </div>
                )}

                {div.rejectedBy && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-red-100 text-red-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-md border bg-card shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-foreground">Rejeitado</div>
                        <time className="font-mono text-xs text-muted-foreground">{div.rejectedAt && new Date(div.rejectedAt).toLocaleDateString()}</time>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">Por: {div.rejectedBy.name}</div>
                      {div.rejectionReason && <div className="text-sm bg-muted p-2 rounded border">{div.rejectionReason}</div>}
                    </div>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <DivergenceForm 
            divergenceId={div.id}
            inventoryId={div.inventoryId}
            status={div.status}
          />
        </div>
      </div>
    </div>
  )
}
