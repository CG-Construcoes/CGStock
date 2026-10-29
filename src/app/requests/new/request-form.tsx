/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Save, Plus, Trash2, Send, Loader2 } from "lucide-react"
import Link from "next/link"
import { createRequestAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { handleAction } from "@/lib/handle-action"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { toast } from "sonner"

type RequestItemData = {
  id: string
  productId: string
  quantity: number
  unitId: string
}

export default function RequestForm({ warehouses, products, userId, sessionExpiresAt }: any) {
  const [items, setItems] = useState<RequestItemData[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittingAction, setSubmittingAction] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string>("PENDING_APPROVAL")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (items.length === 0) {
      toast.error("A requisição deve ter pelo menos um item.")
      return
    }
    if (navigator.onLine && Date.now() >= new Date(sessionExpiresAt).getTime()) {
      toast.error('Sessão expirada. Conecte-se e entre novamente antes de salvar a requisição.')
      return
    }
    const formData = new FormData(e.currentTarget)
    let actionType = pendingAction
    if (e.nativeEvent instanceof SubmitEvent && e.nativeEvent.submitter) {
      const btn = (e.nativeEvent.submitter as HTMLElement).closest('button')
      if (btn && btn.value) actionType = btn.value
    }
    formData.set('actionType', actionType)
    setIsSubmitting(true)
    setSubmittingAction(actionType)

    if (!navigator.onLine) {
      const payload: Record<string, unknown> = {
        warehouseId: formData.get('warehouseId'),
        priority: formData.get('priority'),
        notes: formData.get('notes'),
        actionType,
        items: items.map(i => ({ productId: i.productId, unitId: i.unitId, requestedQuantity: i.quantity }))
      }
      try {
        await queueOfflineOperation('CREATE_REQUEST', payload, userId)
        toast.success("Requisição salva neste dispositivo. Sincronizaremos ao reconectar.")
        setItems([])
      } catch (err) {
        toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"))
      } finally {
        setIsSubmitting(false)
        setSubmittingAction(null)
      }
      return
    }

    try {
      await handleAction(createRequestAction)(formData)
    } finally {
      setIsSubmitting(false)
      setSubmittingAction(null)
    }
  }

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), productId: "", quantity: 1, unitId: "" }])
  }

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof RequestItemData, value: string | number) => {
    setItems(items.map(i => {
      if (i.id === id) {
        const updated = { ...i, [field]: value }
        // Auto-select unit if product is selected
        if (field === 'productId') {
          const product = products.find((p: any) => p.id === value)
          if (product) updated.unitId = product.unitId
        }
        return updated
      }
      return i
    }))
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Requisição</h2>
          <p className="text-muted-foreground">Solicite materiais ao almoxarifado.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Cabeçalho */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Dados da Requisição</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Almoxarifado Destino *</label>
                  <Select name="warehouseId" required>
                    <option value="">Selecione...</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prioridade *</label>
                  <Select name="priority" required defaultValue="NORMAL">
                    <option value="LOW">Baixa</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">Urgente</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações</label>
                  <Input name="notes" placeholder="Justificativa ou centro de custo..." />
                </div>
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-medium">Materiais Solicitados</h3>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Produto
                </Button>
              </div>

              {items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                  Nenhum item adicionado. Clique no botão acima para adicionar.
                </div>
              )}

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-end border p-4 rounded-md bg-muted">
                    <div className="col-span-12 md:col-span-6 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Produto *</label>
                      <SearchableSelect 
                        name={`item_productId_${item.id}`}
                        required 
                        value={item.productId}
                        onChange={value => updateItem(item.id, "productId", value)}
                        options={products.map((p: any) => ({
                          value: p.id,
                          label: `${p.code} - ${p.name}`
                        }))}
                        placeholder="Selecionar..."
                      />
                    </div>
                    
                    <div className="col-span-8 md:col-span-4 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Quantidade Solicitada *</label>
                      <div className="flex gap-2">
                        <Input 
                          name={`item_quantity_${item.id}`}
                          type="number" step="0.0001" 
                          min="1" 
                          required 
                          value={item.quantity || ''}
                          onChange={e => updateItem(item.id, "quantity", Number(e.target.value))}
                        />
                        <Input 
                          name={`item_unitId_${item.id}`}
                          type="hidden" 
                          value={item.unitId}
                        />
                        <div className="flex items-center px-3 bg-gray-200 rounded-md text-sm font-medium">
                          {products.find((p: any) => p.id === item.productId)?.unit.code || '-'}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-4 md:col-span-2 text-right md:text-center pb-2">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Link href="/requests">
                <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
              </Link>
              
              <Button 
                type="submit" 
                name="actionType" 
                value="DRAFT" 
                variant="secondary" 
                disabled={isSubmitting} 
                onClick={() => setPendingAction("DRAFT")}
                className="flex items-center gap-2"
              >
                {isSubmitting && submittingAction === "DRAFT" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando Rascunho...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar Rascunho
                  </>
                )}
              </Button>

              <Button 
                type="submit" 
                name="actionType" 
                value="PENDING_APPROVAL" 
                disabled={isSubmitting} 
                onClick={() => setPendingAction("PENDING_APPROVAL")}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting && submittingAction === "PENDING_APPROVAL" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando Requisição...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar Requisição
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
