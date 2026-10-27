"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Card, CardContent } from "@/components/ui/card"
import { Save, Plus, Trash2, CheckCircle, Loader2, FileUp, X } from "lucide-react"
import Link from "next/link"
import * as XLSX from "xlsx"
import { createReceiptAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"
import { formatCurrency, cn } from "@/lib/utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { parsePedidoSheet, resolvePedidoProduct } from "@/lib/pedido-parser"

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
  const [submittingAction, setSubmittingAction] = useState<"DRAFT" | "COMPLETED" | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [pendingAction, setPendingAction] = useState<"DRAFT" | "COMPLETED">("COMPLETED")
  const [isImportingPedido, setIsImportingPedido] = useState(false)
  const [unmatchedCodes, setUnmatchedCodes] = useState<string[]>([])
  const pedidoFileRef = useRef<HTMLInputElement>(null)

  const filteredLocations = warehouseId ? locations.filter((l) => l.warehouseId === warehouseId) : []

  const defaultLocationId = () => {
    if (filteredLocations.length === 0) return ""
    const geral = filteredLocations.find((l) => /geral/i.test(`${l.code} ${l.name}`))
    return (geral ?? filteredLocations[0]).id
  }

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), productId: "", locationId: "", quantity: 1, unitCost: 0 }])
  }

  const handlePedidoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setIsImportingPedido(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null })
      const parsed = parsePedidoSheet(grid)

      if (parsed.length === 0) {
        toast.error("Nenhum item de pedido encontrado. Verifique se a planilha foi exportada do Informakon.")
        return
      }

      const locationId = defaultLocationId()
      const novos: ItemData[] = []
      const naoEncontrados: string[] = []

      for (const it of parsed) {
        // resolvePedidoProduct escolhe entre code / code-MGA / code-CV pelo
        // nome mais parecido com a especificação do pedido (multi-fonte)
        const product = resolvePedidoProduct(it, products)
        if (!product) {
          naoEncontrados.push(it.productCode)
          continue
        }
        novos.push({
          id: crypto.randomUUID(),
          productId: product.id,
          locationId,
          quantity: it.quantity,
          unitCost: it.unitCost ?? 0,
        })
      }

      setItems((prev) => [...prev, ...novos])
      setUnmatchedCodes(naoEncontrados)

      if (naoEncontrados.length > 0) {
        toast.warning(
          `${novos.length} itens importados. ${naoEncontrados.length} insumos não encontrados no cadastro (lista abaixo).`,
          { duration: 6000 }
        )
      } else {
        toast.success(`${novos.length} itens importados do pedido. Confira as quantidades antes de finalizar.`)
      }
    } catch {
      toast.error("Não foi possível ler a planilha do pedido.")
    } finally {
      setIsImportingPedido(false)
    }
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

    if (isSubmitting || isSuccess) return

    if (items.length === 0) {
      toast.error("Adicione pelo menos um produto para o recebimento.")
      return
    }
    if (Date.now() >= new Date(sessionExpiresAt).getTime()) {
      toast.error('Sessão expirada. Conecte-se e entre novamente antes de salvar a entrada.')
      return
    }

    const formData = new FormData(e.currentTarget)

    const supplierId = formData.get("supplierId") as string
    const targetWarehouseId = (formData.get("warehouseId") as string) || warehouseId

    if (!supplierId) {
      toast.error("Selecione um fornecedor.")
      return
    }

    if (!targetWarehouseId) {
      toast.error("Selecione o almoxarifado destino.")
      return
    }

    const invalidItem = items.find(i => !i.productId || !i.locationId || !i.quantity || i.quantity <= 0)
    if (invalidItem) {
      if (!invalidItem.productId) {
        toast.error("Selecione o produto em todos os itens.")
        return
      }
      if (!invalidItem.quantity || invalidItem.quantity <= 0) {
        toast.error("A quantidade em todos os itens deve ser maior que zero.")
        return
      }
      if (!invalidItem.locationId) {
        toast.error("Selecione a localização em todos os itens.")
        return
      }
    }

    let actionType: "DRAFT" | "COMPLETED" = pendingAction
    if (e.nativeEvent instanceof SubmitEvent && e.nativeEvent.submitter) {
      const btn = (e.nativeEvent.submitter as HTMLElement).closest('button')
      if (btn && (btn.value === 'DRAFT' || btn.value === 'COMPLETED')) {
        actionType = btn.value as "DRAFT" | "COMPLETED"
      }
    }

    formData.set("actionType", actionType)
    setIsSubmitting(true)
    setSubmittingAction(actionType)

    const isCompleting = actionType === "COMPLETED"
    const toastId = toast.loading(
      isCompleting 
        ? "Atualizando estoque e registrando entrada..." 
        : "Salvando rascunho da entrada..."
    )

    if (!navigator.onLine) {
      const payload: Record<string, unknown> = Object.fromEntries(formData.entries())
      payload.items = items
      try {
        await queueOfflineOperation('CREATE_RECEIPT', payload, userId)
        toast.success("Entrada salva neste dispositivo. Sincronizaremos ao reconectar.", { id: toastId })
        setItems([])
        setIsSubmitting(false)
        setSubmittingAction(null)
      } catch (err) {
        toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"), { id: toastId })
        setIsSubmitting(false)
        setSubmittingAction(null)
      }
      return
    }

    try {
      const result = await createReceiptAction(formData)
      if (result?.success) {
        setIsSuccess(true)
        toast.success(
          isCompleting 
            ? "Recebimento finalizado e estoque atualizado com sucesso!" 
            : "Rascunho salvo com sucesso!",
          { id: toastId }
        )
        setTimeout(() => {
          router.push("/receipts")
        }, 500)
      } else {
        const errorMap: Record<string, string> = {
          missing_fields: "Preencha todos os campos obrigatórios.",
          no_valid_items: "Nenhum item válido para o recebimento.",
          invalid_location: "Localização informada inválida para o almoxarifado selecionado.",
          create_failed: "Erro ao registrar o recebimento no banco de dados.",
          forbidden: "Você não tem permissão para esta ação."
        }
        const errorMsg = errorMap[result?.error || ""] || `Erro ao processar recebimento: ${result?.error || 'Erro desconhecido'}`
        toast.error(errorMsg, { id: toastId })
        setIsSubmitting(false)
        setSubmittingAction(null)
      }
    } catch {
      toast.error("Erro inesperado ao processar recebimento.", { id: toastId })
      setIsSubmitting(false)
      setSubmittingAction(null)
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
                <div className="flex items-center gap-2">
                  <input
                    ref={pedidoFileRef}
                    type="file"
                    accept=".xls,.xlsx"
                    className="hidden"
                    onChange={handlePedidoFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pedidoFileRef.current?.click()}
                    disabled={!warehouseId || isImportingPedido}
                    title="Importar itens de um pedido exportado do Informakon (.xlsx)"
                  >
                    {isImportingPedido ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileUp className="h-4 w-4 mr-2" />
                    )}
                    Pedido do Informakon
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={!warehouseId}>
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Produto
                  </Button>
                </div>
              </div>

              {unmatchedCodes.length > 0 && (
                <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-md border border-amber-200 flex items-start gap-2">
                  <div className="flex-1">
                    <span className="font-medium">{unmatchedCodes.length} insumo(s) do pedido sem cadastro ativo:</span>
                    <span className="ml-1 break-all">{unmatchedCodes.join(", ")}</span>
                  </div>
                  <button type="button" onClick={() => setUnmatchedCodes([])} className="text-amber-600 hover:text-amber-800 shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

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

            {/* Feedback animado quando estiver salvando ou atualizando estoque */}
            {isSubmitting && (
              <div className="flex items-center justify-center gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-sm font-medium animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {submittingAction === "COMPLETED"
                    ? "Atualizando estoque e registrando movimentações..."
                    : "Salvando rascunho do recebimento..."}
                </span>
              </div>
            )}

            {isSuccess && (
              <div className="flex items-center justify-center gap-3 p-3.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {submittingAction === "COMPLETED"
                    ? "Estoque atualizado com sucesso! Redirecionando..."
                    : "Rascunho salvo com sucesso! Redirecionando..."}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
              <Link href="/receipts" className={cn("w-full sm:w-auto", (isSubmitting || isSuccess) && "pointer-events-none opacity-50")}>
                <Button type="button" variant="outline" className="w-full" disabled={isSubmitting || isSuccess}>
                  Cancelar
                </Button>
              </Link>
              
              <Button 
                disabled={isSubmitting || isSuccess} 
                type="submit" 
                name="actionType" 
                value="DRAFT" 
                variant="secondary" 
                onClick={() => setPendingAction("DRAFT")}
                onPointerDown={() => setPendingAction("DRAFT")}
                className="w-full sm:w-auto flex items-center justify-center gap-2 transition-all duration-200"
              >
                {isSubmitting && submittingAction === "DRAFT" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Salvando Rascunho...</span>
                  </>
                ) : isSuccess && submittingAction === "DRAFT" ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>Rascunho Salvo!</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Salvar Rascunho</span>
                  </>
                )}
              </Button>

              <Button 
                disabled={isSubmitting || isSuccess} 
                type="submit" 
                name="actionType" 
                value="COMPLETED" 
                onClick={() => setPendingAction("COMPLETED")}
                onPointerDown={() => setPendingAction("COMPLETED")}
                className={cn(
                  "w-full sm:w-auto flex items-center justify-center gap-2 transition-all duration-200 text-white font-medium",
                  isSubmitting && submittingAction === "COMPLETED"
                    ? "bg-emerald-600/90 shadow-md ring-2 ring-emerald-500/50 cursor-wait opacity-95"
                    : isSuccess && submittingAction === "COMPLETED"
                    ? "bg-emerald-600 shadow-md"
                    : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                )}
              >
                {isSubmitting && submittingAction === "COMPLETED" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Atualizando Estoque...</span>
                  </>
                ) : isSuccess && submittingAction === "COMPLETED" ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-white" />
                    <span>Estoque Atualizado!</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Finalizar e Atualizar Estoque</span>
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
