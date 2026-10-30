"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Loader2, PackagePlus, X } from "lucide-react"
import { toast } from "sonner"
import { quickCreateProductAction } from "@/app/products/actions"

export type PendingProduct = {
  code: string
  name: string
  unitCode: string | null
  categoryName: string | null
}

export type CreatedProduct = { id: string; code: string; name: string; averageCost: number }

type Props = {
  pending: PendingProduct
  categories: { id: string; name: string }[]
  units: { id: string; code: string; name: string }[]
  locations: { id: string; code: string; name: string; warehouseId: string }[]
  warehouseId: string
  defaultLocationId: string
  onClose: () => void
  onCreated: (product: CreatedProduct) => void
}

function normText(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

export function QuickProductModal({
  pending, categories, units, locations, warehouseId, defaultLocationId, onClose, onCreated,
}: Props) {
  const [code, setCode] = useState(pending.code)
  const [name, setName] = useState(pending.name)
  const [barcode, setBarcode] = useState("")
  const [categoryId, setCategoryId] = useState(() => {
    if (!pending.categoryName) return ""
    const target = normText(pending.categoryName)
    return categories.find((c) => normText(c.name) === target || normText(c.name).startsWith(target))?.id ?? ""
  })
  const [unitId, setUnitId] = useState(() => {
    if (!pending.unitCode) return ""
    const target = pending.unitCode.toUpperCase()
    return units.find((u) => u.code.toUpperCase() === target)?.id ?? ""
  })
  const [locationId, setLocationId] = useState(defaultLocationId)
  const [minimumStock, setMinimumStock] = useState(0)
  const [maximumStock, setMaximumStock] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return
    if (!code.trim() || !name.trim() || !categoryId || !unitId) {
      toast.error("Preencha código, descrição, categoria e unidade.")
      return
    }
    setIsSaving(true)
    try {
      const result = await quickCreateProductAction({
        code,
        name,
        barcode: barcode || null,
        categoryId,
        unitId,
        minimumStock,
        maximumStock,
        defaultLocationId: locationId || null,
        warehouseId,
      })
      if (result.success) {
        toast.success(
          result.alreadyExisted
            ? `"${result.product.code}" já estava cadastrado — item vinculado.`
            : `Produto "${result.product.code}" cadastrado e vinculado ao item.`
        )
        onCreated(result.product)
        onClose()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Falha ao cadastrar o produto.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={isSaving ? undefined : onClose} />
      <div className="relative w-full sm:max-w-lg bg-background border sm:rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <div className="sticky top-0 bg-background border-b px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">Cadastrar produto novo</h3>
              <p className="text-xs text-muted-foreground">Salva no catálogo e vincula ao item da entrada</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={isSaving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Código *</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex.: 023824-000"
                required
              />
              {/^\d+$/.test(code.trim()) && (
                <p className="text-xs text-muted-foreground">
                  Sem o sub-insumo (ex.: -000) o produto não fica vinculado ao Informakon.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Código de barras</label>
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="EAN/GTIN" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descrição *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Categoria *</label>
              <SearchableSelect
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Pesquisar categoria..."
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              {pending.categoryName && !categoryId && (
                <p className="text-xs text-muted-foreground">Planilha indica: {pending.categoryName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Unidade *</label>
              <SearchableSelect
                value={unitId}
                onChange={setUnitId}
                placeholder="Pesquisar unidade..."
                options={units.map((u) => ({ value: u.id, label: `${u.code} - ${u.name}` }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-sm font-medium">Localização</label>
              <SearchableSelect
                value={locationId}
                onChange={setLocationId}
                placeholder="Nenhuma"
                options={[
                  { value: "", label: "Nenhuma" },
                  ...locations.map((l) => ({ value: l.id, label: `${l.code} - ${l.name}` })),
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Estoque mín.</label>
              <Input type="number" min="0" value={minimumStock || ""} onChange={(e) => setMinimumStock(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Estoque máx.</label>
              <Input type="number" min="0" value={maximumStock || ""} onChange={(e) => setMaximumStock(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cadastrar e vincular
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
