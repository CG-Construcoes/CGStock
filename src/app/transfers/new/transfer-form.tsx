"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Plus, PackageX, ArrowRightLeft } from "lucide-react"
import Link from "next/link"
import { createTransferAction } from "../actions"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { handleAction } from "@/lib/handle-action"
import { toast } from "sonner"

type TransferProduct = { id: string; code: string; name: string; unitId: string | null }
type TransferWarehouse = { id: string; name: string; locations: { id: string; code: string }[] }
type TransferItem = { id: string; productId: string; quantity: number }

export function TransferForm({ warehouses, products, userId, sessionExpiresAt, error }: {
  warehouses: TransferWarehouse[]
  products: TransferProduct[]
  userId: string
  sessionExpiresAt: string
  error?: string
}) {
  const [sourceLocationId, setSourceLocationId] = useState("")
  const [destinationLocationId, setDestinationLocationId] = useState("")
  const [items, setItems] = useState<TransferItem[]>([{ id: crypto.randomUUID(), productId: "", quantity: 1 }])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const locations = warehouses.flatMap(w => w.locations)
  const addItem = () => setItems(prev => [...prev, { id: crypto.randomUUID(), productId: "", quantity: 1 }])
  const removeItem = (id: string) => setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev)
  const updateItem = (id: string, field: keyof TransferItem, value: string | number) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const validItems = items.filter(i => i.productId && Number.isSafeInteger(i.quantity) && i.quantity > 0)
    if (!sourceLocationId || !destinationLocationId) {
      toast.error("Selecione a localização de origem e destino.")
      return
    }
    if (sourceLocationId === destinationLocationId) {
      toast.error("Localização de origem e destino não podem ser iguais.")
      return
    }
    if (!validItems.length || validItems.length !== items.length) {
      toast.error("Informe produto e quantidade inteira maior que zero em todos os itens.")
      return
    }
    if (Date.now() >= new Date(sessionExpiresAt).getTime()) {
      toast.error('Sessão expirada. Conecte-se e entre novamente antes de salvar a transferência.')
      return
    }

    setIsSubmitting(true)
    const payloadItems = validItems.map(i => ({
      productId: i.productId,
      quantity: i.quantity,
      unitId: products.find(p => p.id === i.productId)?.unitId || ""
    }))
    if (payloadItems.some(i => !i.unitId)) {
      toast.error("Produto sem unidade de medida definida.")
      setIsSubmitting(false)
      return
    }

    if (!navigator.onLine) {
      try {
        await queueOfflineOperation('CREATE_TRANSFER', { sourceLocationId, destinationLocationId, items: payloadItems }, userId)
        toast.success("Transferência salva neste dispositivo. Sincronizaremos ao reconectar.")
        setItems([{ id: crypto.randomUUID(), productId: "", quantity: 1 }])
      } catch (err) {
        toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"))
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    const formData = new FormData()
    formData.set("sourceLocationId", sourceLocationId)
    formData.set("destinationLocationId", destinationLocationId)
    payloadItems.forEach(i => {
      formData.append("productId", i.productId)
      formData.append("quantity", String(i.quantity))
      formData.append("unitId", i.unitId)
    })
    try {
      await handleAction(createTransferAction)(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3 slide-in-">
          <PackageX className="h-5 w-5 text-red-600" />
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Informações da Rota</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-amber-600">Localização de Origem *</label>
              <Select required value={sourceLocationId} onChange={e => setSourceLocationId(e.target.value)}>
                <option value="">Selecione de onde vai sair...</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.code}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-emerald-600">Localização de Destino *</label>
              <Select required value={destinationLocationId} onChange={e => setDestinationLocationId(e.target.value)}>
                <option value="">Selecione para onde vai...</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.code}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2 flex items-center justify-between">
            Itens a Transferir
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={addItem}>
              <Plus className="h-4 w-4" /> Adicionar Item
            </Button>
          </h3>

          {items.map(item => (
            <div key={item.id} className="border rounded-lg p-4 bg-muted flex items-start gap-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Produto</label>
                  <Select required value={item.productId} onChange={e => updateItem(item.id, "productId", e.target.value)}>
                    <option value="">Selecione...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Quantidade a mover</label>
                  <Input type="number" step="1" min="1" required value={item.quantity}
                    onChange={e => updateItem(item.id, "quantity", Number(e.target.value))} />
                </div>
              </div>
              {items.length > 1 && (
                <Button type="button" variant="ghost" onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6">
                  <PackageX className="h-5 w-5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t">
          <Link href="/transfers">
            <Button type="button" variant="outline">Cancelar</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Executar Transferência
          </Button>
        </div>
      </form>
    </>
  )
}
