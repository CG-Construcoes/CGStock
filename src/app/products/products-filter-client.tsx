"use client"

import React, { createContext, useContext, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search, Plus, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setActiveWarehouseAction } from "@/app/auth-actions"
import { cn } from "@/lib/utils"

interface ProductsTransitionContextType {
  isPending: boolean
  startTransition: (callback: () => void) => void
  loadingLabel: string | null
  setLoadingLabel: (label: string | null) => void
}

const ProductsTransitionContext = createContext<ProductsTransitionContextType>({
  isPending: false,
  startTransition: () => {},
  loadingLabel: null,
  setLoadingLabel: () => {},
})

export function ProductsTransitionProvider({ children }: { children: React.ReactNode }) {
  const [isPending, startTransition] = useTransition()
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)

  return (
    <ProductsTransitionContext.Provider
      value={{
        isPending,
        startTransition,
        loadingLabel,
        setLoadingLabel,
      }}
    >
      {children}
    </ProductsTransitionContext.Provider>
  )
}

export function useProductsTransition() {
  return useContext(ProductsTransitionContext)
}

export function ProductsFilterForm({
  search,
  selectedWarehouseId,
  warehouses,
  categoryId,
  categories,
  status,
  hasCreate,
}: {
  search: string
  selectedWarehouseId: string
  warehouses: { id: string; name: string }[]
  categoryId: string
  categories: { id: string; name: string }[]
  status: string
  hasCreate: boolean
}) {
  const router = useRouter()
  const { isPending, startTransition, setLoadingLabel } = useProductsTransition()

  const applyFilter = (form: HTMLFormElement, customLabel?: string) => {
    const formData = new FormData(form)
    const params = new URLSearchParams()

    const q = (formData.get("q") as string)?.trim()
    const wId = (formData.get("warehouseId") as string) || ""
    const cat = (formData.get("category") as string) || ""
    const st = (formData.get("status") as string) || ""

    if (q) params.set("q", q)
    if (wId) params.set("warehouseId", wId)
    if (cat) params.set("category", cat)
    if (st) params.set("status", st)

    if (customLabel) {
      setLoadingLabel(customLabel)
    } else {
      const wh = warehouses.find((w) => w.id === wId)
      setLoadingLabel(wh ? `Carregando "${wh.name}"...` : "Filtrando produtos...")
    }

    startTransition(async () => {
      await setActiveWarehouseAction(!wId || wId === "ALL" ? "ALL" : wId)
      const qs = params.toString()
      router.push(qs ? `/products?${qs}` : "/products")
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        applyFilter(e.currentTarget, "Filtrando produtos...")
      }}
      className="flex flex-col sm:flex-row flex-wrap gap-3 w-full sm:w-auto items-stretch sm:items-center"
    >
      <div className="relative w-full sm:w-56">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={search || ""}
          disabled={isPending}
          placeholder="Buscar por Cód.Insumo ou descrição..."
          className={cn("pl-9 h-9 text-sm transition-opacity", isPending && "opacity-75")}
        />
      </div>

      {warehouses.length > 1 && (
        <div className="relative w-full sm:w-48">
          <select
            name="warehouseId"
            value={selectedWarehouseId || "ALL"}
            disabled={isPending}
            onChange={(e) => {
              const val = e.target.value
              const wh = warehouses.find((w) => w.id === val)
              const label =
                val === "ALL" || !wh
                  ? 'Carregando "Todos os Almoxarifados"...'
                  : `Carregando "${wh.name}"...`
              if (e.target.form) applyFilter(e.target.form, label)
            }}
            className={cn(
              "h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-80",
              isPending && "border-primary/60 ring-1 ring-primary/40 bg-muted/20"
            )}
          >
            <option value="ALL">Almoxarifados (Todos)</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
      )}

      <div className="relative w-full sm:w-40">
        <select
          name="category"
          defaultValue={categoryId || ""}
          disabled={isPending}
          onChange={(e) => {
            if (e.target.form) applyFilter(e.target.form, "Filtrando por categoria...")
          }}
          className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-80"
        >
          <option value="">Categorias (Todas)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      <div className="relative w-full sm:w-32">
        <select
          name="status"
          defaultValue={status || ""}
          disabled={isPending}
          onChange={(e) => {
            if (e.target.form) applyFilter(e.target.form, "Filtrando por status...")
          }}
          className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-80"
        >
          <option value="">Status (Todos)</option>
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
        </select>
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      <Button type="submit" variant="secondary" disabled={isPending} className="h-9 px-3 text-sm">
        {isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-primary" />
            Filtrando...
          </>
        ) : (
          "Filtrar"
        )}
      </Button>

      <div className="h-6 w-px bg-border hidden sm:block mx-1"></div>

      {hasCreate && (
        <Link href="/products/new">
          <Button
            type="button"
            className="h-9 px-3 text-sm bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        </Link>
      )}
    </form>
  )
}

export function ProductsContentWrapper({ children }: { children: React.ReactNode }) {
  const { isPending, loadingLabel } = useProductsTransition()

  return (
    <div className="relative flex-1 flex flex-col space-y-4 min-h-[300px]">
      {isPending && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-30 flex items-start justify-center pt-24 bg-background/50 backdrop-blur-[2px] rounded-md transition-all duration-300"
        >
          <div className="sticky top-28 flex items-center gap-3 bg-card border border-primary/40 shadow-xl px-5 py-3 rounded-full text-foreground backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {loadingLabel || "Atualizando produtos..."}
            </span>
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex-1 flex flex-col space-y-4 transition-all duration-200",
          isPending && "opacity-40 pointer-events-none select-none filter blur-[0.4px]"
        )}
      >
        {children}
      </div>
    </div>
  )
}
