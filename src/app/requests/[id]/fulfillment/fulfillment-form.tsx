/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {  CheckCircle } from "lucide-react"
import Link from "next/link"
import { fulfillRequestAction } from "../../actions"
import { BackButton } from "@/components/ui/back-button"
import { handleAction } from "@/lib/handle-action"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { toast } from "sonner"

export default function FulfillmentForm({ request, userId, sessionExpiresAt }: any) {
  const hasPendingItems = request.items.some((item: any) => (item.approvedQuantity - item.deliveredQuantity) > 0)

  if (!hasPendingItems || request.status === 'FULFILLED') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-md border mt-8 shadow-sm">
        <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
        <h2 className="text-2xl font-bold">Requisição Totalmente Atendida</h2>
        <p className="text-muted-foreground mt-2 mb-6">Todos os itens desta requisição já foram entregues.</p>
        <Link href={`/requests/${request.id}`}>
          <Button variant="outline">Voltar para a Requisição</Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Atender Requisição {request.requestNumber}</h2>
          <p className="text-muted-foreground">Informe a quantidade a ser entregue e o local de retirada.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form
            className="space-y-8"
            onSubmit={async (e) => {
              e.preventDefault()
              const form = e.currentTarget
              const formData = new FormData(form)
              const items = Array.from(formData.keys())
                .filter(k => k.startsWith('delivery_quantity_'))
                .map(key => {
                  const suffix = key.replace('delivery_quantity_', '')
                  return {
                    itemId: suffix,
                    locationId: String(formData.get(`delivery_location_${suffix}`) || ''),
                    quantity: Number(formData.get(key))
                  }
                })
                .filter(d => d.quantity > 0 && d.locationId)

              if (!items.length) {
                toast.error("Por favor, preencha a quantidade e selecione o local de retirada de pelo menos um item.")
                return
              }

              if (!navigator.onLine) {
                try {
                  await queueOfflineOperation('FULFILL_REQUEST', { requestId: request.id, items }, userId)
                  toast.success("Atendimento salvo neste dispositivo. Sincronizaremos automaticamente ao reconectar.")
                  form.reset()
                } catch (err) {
                  toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"))
                }
                return
              }

              await handleAction(fulfillRequestAction)(formData)
            }}
          >
            <input type="hidden" name="requestId" value={request.id} />

            <div className="space-y-4">
              {request.items.map((item: any) => {
                const pending = item.approvedQuantity - item.deliveredQuantity
                if (pending <= 0) return null

                // Filtra os estoques disponíveis do produto no almoxarifado destino
                const availableStocks = item.product.stocks.filter((s: any) => s.location.warehouseId === request.warehouseId && s.quantity > 0)
                const hasStock = availableStocks.length > 0

                return (
                  <div key={item.id} className={`grid grid-cols-12 gap-3 items-end border p-4 rounded-md ${hasStock ? 'bg-card' : 'bg-red-50 border-red-200'}`}>
                    <div className="col-span-12 md:col-span-4 space-y-1">
                      <label className="text-sm font-medium text-foreground">{item.product.code} - {item.product.name}</label>
                      <div className="text-xs text-muted-foreground">
                        Aprovado: {item.approvedQuantity} | Entregue: {item.deliveredQuantity} | Pendente: <span className="font-bold text-foreground">{pending}</span> {item.unit.code}
                      </div>
                    </div>
                    
                    {hasStock ? (
                      <>
                        <div className="col-span-6 md:col-span-4 space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Retirar da Localização *</label>
                          <Select name={`delivery_location_${item.id}`}>
                            <option value="">Selecionar local com saldo...</option>
                            {availableStocks.map((s: any) => (
                              <option key={s.locationId} value={s.locationId}>
                                {s.location.code} - Saldo: {s.quantity}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="col-span-6 md:col-span-4 space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Qtd para Entrega *</label>
                          <Input 
                            name={`delivery_quantity_${item.id}`}
                            type="number" step="0.0001" 
                            min="0" 
                            max={pending}
                            placeholder={`Máx: ${pending}`}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="col-span-12 md:col-span-8 text-sm text-red-600 font-medium">
                        Estoque insuficiente neste almoxarifado. A operação não pode ser concluída para este item.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Link href={`/requests/${request.id}`}>
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              
              <Button type="submit" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle className="h-4 w-4" />
                Confirmar Entrega
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
