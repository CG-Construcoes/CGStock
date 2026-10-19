"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Filter, Search, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { setActiveWarehouseAction } from "@/app/auth-actions"

export function MovementsFilterForm({
  products,
  warehouses,
  defaultValues
}: {
  products: { id: string; code: string; name: string }[]
  warehouses: { id: string; name: string }[]
  defaultValues: { q: string; type: string; productId: string; warehouseId: string; referenceType: string }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  
  const [q, setQ] = useState(defaultValues.q)
  const [type, setType] = useState(defaultValues.type)
  const [productId, setProductId] = useState(defaultValues.productId)
  const [warehouseId, setWarehouseId] = useState(defaultValues.warehouseId)

  const applyFilter = (
    nextValues: { q: string; type: string; productId: string; warehouseId: string },
    customLabel?: string
  ) => {
    setLoadingLabel(customLabel || "Filtrando movimentações...")
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())

      if (nextValues.q) params.set("q", nextValues.q)
      else params.delete("q")

      if (nextValues.type && nextValues.type !== "ALL") params.set("type", nextValues.type)
      else params.delete("type")

      if (nextValues.productId && nextValues.productId !== "ALL") params.set("productId", nextValues.productId)
      else params.delete("productId")

      if (nextValues.warehouseId && nextValues.warehouseId !== "ALL") {
        params.set("warehouseId", nextValues.warehouseId)
        if (typeof document !== "undefined") {
          document.cookie = `cgstock_active_warehouse=${encodeURIComponent(nextValues.warehouseId)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
        }
      } else {
        params.delete("warehouseId")
        if (typeof document !== "undefined") {
          document.cookie = "cgstock_active_warehouse=; path=/; max-age=0; SameSite=Lax"
        }
      }

      params.delete("page")

      const qs = params.toString()
      router.push(qs ? `/movements?${qs}` : "/movements")
    })
  }

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilter({ q, type, productId, warehouseId })
  }

  const clearFilters = () => {
    setQ("")
    setType("")
    setProductId("")
    setWarehouseId("")
    setLoadingLabel("Limpando filtros...")
    startTransition(() => {
      if (typeof document !== "undefined") {
        document.cookie = "cgstock_active_warehouse=; path=/; max-age=0; SameSite=Lax"
      }
      router.push("/movements")
    })
  }

  const hasActiveFilters = Boolean(q || (type && type !== 'ALL') || (productId && productId !== 'ALL') || (warehouseId && warehouseId !== 'ALL'))

  return (
    <>
      {isPending && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-background/50 backdrop-blur-[2px] transition-all duration-200"
        >
          <div className="flex items-center gap-3 bg-card border border-primary/40 shadow-xl px-5 py-3 rounded-full text-foreground backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {loadingLabel || "Filtrando movimentações..."}
            </span>
          </div>
        </div>
      )}
      <form onSubmit={handleFilter} className="flex flex-col gap-4 bg-card p-4 rounded-lg border border-border">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              value={q}
              disabled={isPending}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por documento..." 
              className="pl-9" 
            />
          </div>
          
          <Select
            value={type || "ALL"}
            disabled={isPending}
            onChange={(e) => {
              const nextType = e.target.value
              setType(nextType)
              applyFilter({ q, type: nextType, productId, warehouseId })
            }}
            className="w-full sm:w-[180px]"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="ENTRY">Entrada</option>
            <option value="EXIT">Saída</option>
            <option value="ADJUSTMENT_IN">Ajuste (+)</option>
            <option value="ADJUSTMENT_OUT">Ajuste (-)</option>
            <option value="TRANSFER_IN">Transferência (+)</option>
            <option value="TRANSFER_OUT">Transferência (-)</option>
            <option value="RETURN">Devolução</option>
          </Select>

          <Select
            value={productId || "ALL"}
            disabled={isPending}
            onChange={(e) => {
              const nextProductId = e.target.value
              setProductId(nextProductId)
              applyFilter({ q, type, productId: nextProductId, warehouseId })
            }}
            className="w-full sm:w-[220px]"
          >
            <option value="ALL">Todos os Produtos</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
            ))}
          </Select>

          <Select
            value={warehouseId || "ALL"}
            disabled={isPending}
            onChange={(e) => {
              const nextWhId = e.target.value
              setWarehouseId(nextWhId)
              const wh = warehouses.find(w => w.id === nextWhId)
              const label = nextWhId === "ALL" || !wh
                ? 'Carregando "Todos os Almoxarifados"...'
                : `Carregando "${wh.name}"...`
              applyFilter({ q, type, productId, warehouseId: nextWhId }, label)
            }}
            className="w-full sm:w-[180px]"
          >
            <option value="ALL">Todos Almoxarifados</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>

          <Button type="submit" disabled={isPending} className="flex items-center gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
            {isPending ? "Filtrando..." : "Filtrar"}
          </Button>
          {hasActiveFilters && (
            <Button type="button" variant="outline" disabled={isPending} onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </div>
      </form>
    </>
  )
}
