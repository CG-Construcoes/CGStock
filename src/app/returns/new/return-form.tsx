"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Save, Plus, PackageX } from "lucide-react"
import Link from "next/link"
import { createReturnAction } from "../actions"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { handleAction } from "@/lib/handle-action"
import { toast } from "sonner"

type ReturnProduct = { id: string; code: string; name: string; unitId: string | null }
type ReturnWarehouse = { id: string; name: string; locations: { id: string; code: string }[] }
type ReturnRequest = { id: string; requestNumber: string }
type ReturnItem = { id: string; productId: string; locationId: string; quantity: number; condition: 'GOOD' | 'DAMAGED' | 'UNUSABLE' }

const newItem = (): ReturnItem => ({ id: crypto.randomUUID(), productId: "", locationId: "", quantity: 1, condition: 'GOOD' })

export function ReturnForm({ warehouses, products, requests, userId, sessionExpiresAt }: {
  warehouses: ReturnWarehouse[]
  products: ReturnProduct[]
  requests: ReturnRequest[]
  userId: string
  sessionExpiresAt: string
}) {
  const [warehouseId, setWarehouseId] = useState("")
  const [requestId, setRequestId] = useState("")
  const [reason, setReason] = useState("")
  const [items, setItems] = useState<ReturnItem[]>([newItem()])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const locations = warehouses.find(w => w.id === warehouseId)?.locations ?? warehouses.flatMap(w => w.locations)
  const updateItem = (id: string, fields: Partial<ReturnItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!warehouseId) {
      toast.error("Selecione o almoxarifado de destino.")
      return
    }
    const validItems = items.filter(i => i.productId && i.locationId && Number.isSafeInteger(i.quantity) && i.quantity > 0)
    if (!validItems.length || validItems.length !== items.length) {
      toast.error("Informe produto, localização e quantidade inteira maior que zero em todos os itens.")
      return
    }
    if (navigator.onLine && Date.now() >= new Date(sessionExpiresAt).getTime()) {
      toast.error('Sessão expirada. Conecte-se e entre novamente antes de salvar a devolução.')
      return
    }

    setIsSubmitting(true)
    const payloadItems = validItems.map(i => ({
      productId: i.productId,
      locationId: i.locationId,
      quantity: i.quantity,
      condition: i.condition,
      unitId: products.find(p => p.id === i.productId)?.unitId || ""
    }))
    if (payloadItems.some(i => !i.unitId)) {
      toast.error("Produto sem unidade de medida definida.")
      setIsSubmitting(false)
      return
    }

    if (!navigator.onLine) {
      try {
        await queueOfflineOperation('CREATE_RETURN', { warehouseId, requestId: requestId || null, reason, items: payloadItems }, userId)
        toast.success("Devolução salva neste dispositivo. Sincronizaremos ao reconectar.")
        setItems([newItem()])
      } catch (err) {
        toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"))
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    const formData = new FormData()
    formData.set("warehouseId", warehouseId)
    formData.set("requestId", requestId)
    formData.set("reason", reason)
    payloadItems.forEach(i => {
      formData.append("productId", i.productId)
      formData.append("locationId", i.locationId)
      formData.append("quantity", String(i.quantity))
      formData.append("condition", i.condition)
      formData.append("unitId", i.unitId)
    })
    try {
      await handleAction(createReturnAction)(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2">Informações da Devolução</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Almoxarifado de Destino</label>
            <Select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
              <option value="">Selecione...</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Requisição Original (Opcional)</label>
            <Select value={requestId} onChange={e => setRequestId(e.target.value)}>
              <option value="">Nenhuma (Devolução Avulsa)</option>
              {requests.map(r => (
                <option key={r.id} value={r.id}>{r.requestNumber}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo</label>
            <Input placeholder="Ex: Sobrou da obra X" required value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2 flex items-center justify-between">
          Itens a Devolver
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => setItems(prev => [...prev, newItem()])}>
            <Plus className="h-4 w-4" /> Adicionar Item
          </Button>
        </h3>

        {items.map(item => (
          <div key={item.id} className="border rounded-lg p-4 bg-muted flex items-start gap-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-medium">Produto</label>
                <SearchableSelect
                  required
                  options={products.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
                  value={item.productId}
                  onChange={val => updateItem(item.id, { productId: val })}
                  placeholder="Selecione..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Qtd</label>
                <Input type="number" step="1" min="1" required value={item.quantity}
                  onChange={e => updateItem(item.id, { quantity: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-medium">Condição</label>
                <Select value={item.condition} onChange={e => updateItem(item.id, { condition: e.target.value as ReturnItem['condition'] })}>
                  <option value="GOOD">Bom Estado (Retorna p/ Estoque)</option>
                  <option value="DAMAGED">Danificado (Fica segregado)</option>
                  <option value="UNUSABLE">Inutilizável (Descarte)</option>
                </Select>
              </div>
              <div className="col-span-5 space-y-2">
                <label className="text-xs font-medium">Localização no Almoxarifado</label>
                <Select required value={item.locationId} onChange={e => updateItem(item.id, { locationId: e.target.value })}>
                  <option value="">Selecione o local de guarda...</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.code}</option>
                  ))}
                </Select>
              </div>
            </div>
            {items.length > 1 && (
              <Button type="button" variant="ghost" onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6">
                <PackageX className="h-5 w-5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <Link href="/returns">
          <Button type="button" variant="outline">Cancelar</Button>
        </Link>
        <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
          <Save className="h-4 w-4" />
          Receber Devolução
        </Button>
      </div>
    </form>
  )
}
