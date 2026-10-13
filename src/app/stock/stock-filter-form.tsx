"use client"

import { Search, Filter, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useStockTransition } from "./stock-transition-context"
import { cn } from "@/lib/utils"

export function StockFilterForm({
  q,
  selectedWarehouseId,
  warehouses,
  stockFilter,
}: {
  q: string
  selectedWarehouseId: string
  warehouses: { id: string; name: string }[]
  stockFilter?: string
}) {
  const router = useRouter()
  const { isPending, startTransition, setLoadingWarehouseName } = useStockTransition()

  const handleFilter = (form: HTMLFormElement) => {
    const formData = new FormData(form)
    const searchParams = new URLSearchParams()

    const query = (formData.get("q") as string)?.trim()
    const wId = formData.get("warehouseId") as string
    const sFilter = formData.get("stockFilter") as string

    if (query) searchParams.set("q", query)
    if (wId) searchParams.set("warehouseId", wId)
    if (sFilter) searchParams.set("stockFilter", sFilter)

    const selectedWh = warehouses.find((w) => w.id === wId)
    setLoadingWarehouseName(selectedWh ? selectedWh.name : wId ? null : "Todos os Almoxarifados")

    startTransition(() => {
      router.push(`/stock?${searchParams.toString()}`)
    })
  }

  return (
    <form
      className="relative flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-md border border-border shadow-sm overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault()
        handleFilter(e.currentTarget)
      }}
    >
      {/* Barra de progresso animada ao trocar filtros */}
      {isPending && (
        <div className="absolute inset-x-0 top-0 h-[2.5px] bg-primary/20 overflow-hidden">
          <div className="h-full bg-primary animate-indeterminate" />
        </div>
      )}

      <input type="hidden" name="stockFilter" defaultValue={stockFilter || ""} />
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          disabled={isPending}
          placeholder="Buscar por cód. insumo ou produto..."
          className={cn("pl-9 transition-opacity", isPending && "opacity-75")}
        />
      </div>
      <div className="relative w-full sm:w-64">
        <select
          name="warehouseId"
          defaultValue={selectedWarehouseId}
          disabled={isPending}
          onChange={(e) => {
            if (e.target.form) handleFilter(e.target.form)
          }}
          className={cn(
            "flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm ring-offset-background transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-80",
            isPending && "border-primary/60 ring-1 ring-primary/40 bg-muted/20"
          )}
        >
          <option value="">Todos os Almoxarifados</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="outline"
          disabled={isPending}
          className={cn(
            "flex items-center gap-2 min-w-[95px] transition-all",
            isPending && "border-primary/40 text-primary"
          )}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Filtrando...</span>
            </>
          ) : (
            <>
              <Filter className="h-4 w-4" />
              <span>Filtrar</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
