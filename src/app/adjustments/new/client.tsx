"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BackButton } from "@/components/ui/back-button"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { createAdjustmentAction } from "./actions"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { Loader2 } from "lucide-react"

type AdjustmentWarehouse = { id: string; name: string; locations: { id: string; code: string; name: string }[] }
type AdjustmentProduct = { id: string; code: string; name: string; category?: { name: string } | null }

export function AdjustmentClient({ warehouses, products, userId, sessionExpiresAt }: { warehouses: AdjustmentWarehouse[], products: AdjustmentProduct[], userId: string, sessionExpiresAt: string }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    warehouseId: '',
    locationId: '',
    productId: '',
    type: 'ADJUSTMENT_IN' as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
    quantity: 1,
    reason: ''
  })

  const selectedWarehouse = warehouses.find(w => w.id === formData.warehouseId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.warehouseId || !formData.locationId || !formData.productId) {
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }
    if (!Number.isSafeInteger(formData.quantity)) {
      toast.error("A quantidade deve ser um número inteiro.")
      return
    }
    if (Date.now() >= new Date(sessionExpiresAt).getTime()) {
      toast.error('Sessão expirada. Conecte-se e entre novamente antes de salvar o ajuste.')
      return
    }

    setIsSubmitting(true)

    if (!navigator.onLine) {
      try {
        await queueOfflineOperation('CREATE_ADJUSTMENT', { ...formData }, userId)
        toast.success("Ajuste salvo neste dispositivo. Sincronizaremos ao reconectar.")
        setFormData(f => ({ ...f, productId: '', locationId: '', quantity: 1, reason: '' }))
      } catch (err) {
        toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"))
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    const result = await createAdjustmentAction(formData)
    setIsSubmitting(false)

    if (result.success) {
      toast.success("Ajuste registrado com sucesso!")
      router.push('/movements')
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ajuste Manual</h2>
          <p className="text-muted-foreground">Registre correções de saldo de estoque (Entrada ou Saída).</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Detalhes do Ajuste</CardTitle>
            <CardDescription>O ajuste refletirá imediatamente no saldo do produto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="space-y-2">
              <Label>Produto *</Label>
              <SearchableSelect
                options={products.map(p => ({
                  value: p.id,
                  label: `${p.code} - ${p.name}${p.category?.name ? ` (${p.category.name})` : ""}`
                }))}
                value={formData.productId}
                onChange={(val) => setFormData(f => ({ ...f, productId: val }))}
                placeholder="Selecione um produto..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Almoxarifado *</Label>
                <select 
                  value={formData.warehouseId} 
                  onChange={(e) => setFormData(f => ({ ...f, warehouseId: e.target.value, locationId: '' }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecione...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Localização *</Label>
                <select 
                  value={formData.locationId} 
                  onChange={(e) => setFormData(f => ({ ...f, locationId: e.target.value }))} 
                  disabled={!selectedWarehouse}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecione...</option>
                  {selectedWarehouse?.locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Ajuste *</Label>
                <select 
                  value={formData.type} 
                  onChange={(e) => setFormData(f => ({ ...f, type: e.target.value as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' }))}
                  className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${formData.type === 'ADJUSTMENT_IN' ? 'text-success font-semibold' : 'text-destructive font-semibold'}`}
                >
                  <option value="ADJUSTMENT_IN" className="text-success font-semibold">Entrada (Adicionar)</option>
                  <option value="ADJUSTMENT_OUT" className="text-destructive font-semibold">Saída (Remover)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade *</Label>
                <Input 
                  type="number" 
                  step="0.0001" 
                  min="0.0001" 
                  required 
                  value={formData.quantity}
                  onChange={(e) => setFormData(f => ({ ...f, quantity: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo do Ajuste *</Label>
              <Textarea 
                required 
                placeholder="Ex: Produto encontrado avariado, erro na contagem..." 
                className="resize-none"
                value={formData.reason}
                onChange={(e) => setFormData(f => ({ ...f, reason: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">O motivo será registrado na auditoria e não poderá ser apagado.</p>
            </div>

          </CardContent>
          <div className="flex justify-end p-6 border-t bg-muted/20 gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar Ajuste
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
