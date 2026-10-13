"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Card, CardContent } from "@/components/ui/card"
import {  Save, Plus, Trash2, CheckCircle } from "lucide-react"
import Link from "next/link"
import { createReceiptAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { queueOfflineOperation } from "@/lib/offline-sync"

type ItemData = {
  id: string
  productId: string
  locationId: string
  quantity: number
  unitCost: number
}

type ReceiptFormProps = {
  userId: string
  sessionExpiresAt: string
  suppliers: { id: string; name: string; document: string | null }[]
  warehouses: { id: string; name: string }[]
  products: { id: string; code: string; name: string; averageCost: unknown }[]
  locations: { id: string; code: string; name: string; warehouseId: string }[]
}

export default function ReceiptForm({ userId, sessionExpiresAt, suppliers, warehouses, products, locations }: ReceiptFormProps) {
  const router = useRouter()
  const [warehouseId, setWarehouseId] = useState("")
  const [items, setItems] = useState<ItemData[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredLocations = warehouseId ? locations.filter((l) => l.warehouseId === warehouseId) : []

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), productId: "", locationId: "", quantity: 1, unitCost: 0 }])
  }

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof ItemData, value: string | number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const updateItemFields = (id: string, fields: Partial<ItemData>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i))
  }

  const total = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (items.length === 0) {
      toast.error("Adicione pelo menos um produto para o recebimento.")
      return
    }
    if (Date.now() >= new Date(sessionExpiresAt).getTime()) {
      toast.error('Sessão expirada. Conecte-se e entre novamente antes de salvar a entrada.')
      return
    }

    const formData = new FormData(e.currentTarget)
    const actionType = (e.nativeEvent instanceof SubmitEvent && e.nativeEvent.submitter instanceof HTMLButtonElement)
      ? e.nativeEvent.submitter.value || "DRAFT"
      : "DRAFT"
    formData.set("actionType", actionType)

    setIsSubmitting(true)

    if (!navigator.onLine) {
      const payload: Record<string, unknown> = Object.fromEntries(formData.entries())
      payload.items = items
      try {
        await queueOfflineOperation('CREATE_RECEIPT', payload, userId)
        toast.success("Entrada salva neste dispositivo. Sincronizaremos ao reconectar.")
        setItems([])
        setIsSubmitting(false)
      } catch (err) {
        toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"))
        setIsSubmitting(false)
      }
      return
    }

    try {
      const result = await createReceiptAction(formData)
      if (result?.success) {
        toast.success("Recebimento processado com sucesso!")
        router.push("/receipts")
      } else {
        toast.error(`Erro ao processar recebimento: ${result?.error}`)
      }
    } catch {
      toast.error("Erro inesperado ao processar recebimento.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Entrada</h2>
          <p className="text-muted-foreground">Registre o recebimento de materiais.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Cabeçalho */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Dados do Recebimento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fornecedor *</label>
                  <Select name="supplierId" required>
                    <option value="">Selecione...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} {s.document ? `(${s.document})` : ''}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Almoxarifado Destino *</label>
                  <Select 
                    name="warehouseId" 
                    required 
                    value={warehouseId} 
                    onChange={e => setWarehouseId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Número do Documento / NF</label>
                  <Input name="documentNumber" placeholder="Ex: NF 123456" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data do Documento</label>
                  <Input name="documentDate" type="date" />
                </div>
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-medium">Itens da Entrada</h3>
                <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={!warehouseId}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Produto
                </Button>
              </div>

              {!warehouseId && (
                <div className="p-4 bg-yellow-50 text-yellow-700 text-sm rounded-md border border-yellow-200">
                  Selecione um Almoxarifado destino primeiro para adicionar itens.
                </div>
              )}

              {items.length === 0 && warehouseId && (
                <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                  Nenhum item adicionado. Clique no botão acima para adicionar.
                </div>
              )}

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-end border p-4 rounded-md bg-muted">
                    <div className="col-span-12 md:col-span-4 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Produto *</label>
                      <SearchableSelect 
                        name="item_productId" 
                        required 
                        value={item.productId}
                        onChange={val => {
                          const product = products.find((p) => p.id === val)
                          updateItemFields(item.id, { 
                            productId: val, 
                            unitCost: product && product.averageCost ? Number(product.averageCost) : 0 
                          })
                        }}
                        options={products.map((p) => ({
                          value: p.id,
                          label: `${p.code} - ${p.name}`
                        }))}
                      />
                    </div>
                    
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Qtd *</label>
                      <Input 
                        name="item_quantity" 
                        type="number" step="0.0001" 
                        min="1" 
                        required 
                        value={item.quantity || ''}
                        onChange={e => updateItem(item.id, "quantity", Number(e.target.value))}
                      />
                    </div>
                    
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Custo Unitário (R$)</label>
                      <Input 
                        name="item_unitCost" 
                        type="number" step="0.0001" 
                        min="0"
                        value={item.unitCost || ''}
                        onChange={e => updateItem(item.id, "unitCost", Number(e.target.value))}
                      />
                    </div>

                    <div className="col-span-12 md:col-span-3 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Localização *</label>
                      <Select 
                        name="item_locationId" 
                        required
                        value={item.locationId}
                        onChange={e => updateItem(item.id, "locationId", e.target.value)}
                      >
                        <option value="">Selecionar...</option>
                        {filteredLocations.map((l) => (
                          <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                        ))}
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-1 text-right md:text-center pb-2">
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

              {items.length > 0 && (
                <div className="flex justify-end pt-2">
                  <div className="bg-blue-50 text-blue-900 px-4 py-2 rounded-lg font-medium border border-blue-100 flex items-center gap-3">
                    <span>Total Estimado:</span>
                    <span className="text-xl font-bold">{formatCurrency(total)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
              <Link href="/receipts" className="w-full sm:w-auto">
                <Button type="button" variant="outline" className="w-full">Cancelar</Button>
              </Link>
              
              <Button disabled={isSubmitting} type="submit" name="actionType" value="DRAFT" variant="secondary" className="w-full sm:w-auto flex items-center justify-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Rascunho
              </Button>

              <Button disabled={isSubmitting} type="submit" name="actionType" value="COMPLETED" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle className="h-4 w-4" />
                Finalizar e Atualizar Estoque
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
