"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { reviewDivergenceAction, approveDivergenceAction, rejectDivergenceAction } from "./actions"

export default function DivergenceForm({ divergenceId, inventoryId, status }: { divergenceId: string, inventoryId: string, status: string }) {
  const reviewAction = reviewDivergenceAction.bind(null, divergenceId, inventoryId)
  const approveAction = approveDivergenceAction.bind(null, divergenceId, inventoryId)
  const rejectAction = rejectDivergenceAction.bind(null, divergenceId, inventoryId)

  if (['APPROVED', 'REJECTED', 'ADJUSTED'].includes(status)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ações Bloqueadas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta divergência já foi processada e não pode receber novas ações.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {status === 'PENDING' && (
        <Card>
          <CardHeader>
            <CardTitle>Revisar Divergência</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={reviewAction} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Observações da Revisão</label>
                <Textarea name="notes" placeholder="Descreva os achados da recontagem ou análise..." />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Marcar como Revisado
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {(status === 'PENDING' || status === 'REVIEWED') && (
        <Card className="border-emerald-200">
          <CardHeader className="bg-emerald-50 border-b border-emerald-100 rounded-t-xl pb-4">
            <CardTitle className="text-emerald-800">Aprovar e Ajustar Estoque</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form action={approveAction} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Observação (Opcional)</label>
                <Textarea name="notes" placeholder="Motivo da aprovação..." />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Aprovar e Gerar Movimentação
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {(status === 'PENDING' || status === 'REVIEWED') && (
        <Card className="border-red-200">
          <CardHeader className="bg-red-50 border-b border-red-100 rounded-t-xl pb-4">
            <CardTitle className="text-red-800">Rejeitar Divergência</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form action={rejectAction} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo da Rejeição *</label>
                <Textarea name="reason" placeholder="Obrigatório..." required />
              </div>
              <Button type="submit" variant="destructive" className="w-full">
                Rejeitar (Não Alterar Estoque)
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
