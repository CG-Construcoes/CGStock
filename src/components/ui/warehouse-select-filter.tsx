"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Building2, ChevronDown, Loader2 } from "lucide-react"
import { setActiveWarehouseAction } from "@/app/auth-actions"
import { cn } from "@/lib/utils"

export interface WarehouseOption {
  id: string
  name: string
  code?: string
}

interface WarehouseSelectFilterProps {
  warehouses: WarehouseOption[]
  selectedWarehouseId: string
  paramName?: string
  syncGlobalCookie?: boolean
  allLabel?: string
  className?: string
  compact?: boolean
  /** "inline": texto pequeno clicável (usado no topo do celular) */
  appearance?: "field" | "inline"
}

export function WarehouseSelectFilter({
  warehouses,
  selectedWarehouseId,
  paramName = "warehouseId",
  syncGlobalCookie = true,
  allLabel = "Todos os Almoxarifados",
  className,
  compact = false,
  appearance = "field",
}: WarehouseSelectFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [loadingName, setLoadingName] = useState<string | null>(null)

  // Se o usuário só tem acesso a 1 almoxarifado, exibe apenas o badge informativo (ou oculta o dropdown de troca)
  if (warehouses.length === 0) return null

  if (warehouses.length === 1) {
    const single = warehouses[0]
    if (appearance === "inline") {
      return (
        <span className={cn("flex min-w-0 items-center gap-1 text-xs text-muted-foreground", className)}>
          <Building2 className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate">{single.name}</span>
        </span>
      )
    }
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-xs font-medium text-foreground",
          compact ? "h-8 py-1" : "h-9 py-1.5",
          className
        )}
        title={`Almoxarifado: ${single.name}`}
      >
        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="truncate max-w-[160px] sm:max-w-[200px]">{single.name}</span>
      </div>
    )
  }

  const handleChange = (newWarehouseId: string) => {
    const selectedWh = warehouses.find((w) => w.id === newWarehouseId)
    setLoadingName(selectedWh ? selectedWh.name : allLabel)

    startTransition(() => {
      if (syncGlobalCookie && typeof document !== "undefined") {
        if (!newWarehouseId || newWarehouseId === "ALL") {
          document.cookie = "cgstock_active_warehouse=; path=/; max-age=0; SameSite=Lax"
        } else {
          document.cookie = `cgstock_active_warehouse=${encodeURIComponent(newWarehouseId)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
        }
      }

      const params = new URLSearchParams(searchParams.toString())
      if (params.has(paramName) || !syncGlobalCookie) {
        if (newWarehouseId) {
          params.set(paramName, newWarehouseId)
        } else {
          params.delete(paramName)
        }
      }

      // Reset page to 1 when switching warehouse filter
      if (params.has("page")) {
        params.delete("page")
      }

      const queryStr = params.toString()
      const currentQueryStr = searchParams.toString()
      if (queryStr !== currentQueryStr) {
        router.push(queryStr ? `${pathname}?${queryStr}` : pathname)
      } else {
        router.refresh()
      }
    })
  }

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
              {loadingName ? `Carregando "${loadingName}"...` : "Filtrando almoxarifado..."}
            </span>
          </div>
        </div>
      )}
      {appearance === "inline" ? (
        <div className={cn("relative flex min-w-0 max-w-full items-center gap-1 text-xs font-medium text-primary", className)}>
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {warehouses.find((w) => w.id === selectedWarehouseId)?.name ?? allLabel}
          </span>
          {isPending ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0" />
          )}
          <select
            value={selectedWarehouseId}
            disabled={isPending}
            onChange={(e) => handleChange(e.target.value)}
            aria-label="Trocar almoxarifado"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            <option value="">{allLabel}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
      <div className={cn("relative inline-flex items-center", className)}>
        <Building2 className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-primary shrink-0 z-10" />
        <select
          value={selectedWarehouseId}
          disabled={isPending}
          onChange={(e) => handleChange(e.target.value)}
          aria-label="Selecionar almoxarifado"
          className={cn(
            "w-full appearance-none rounded-md border border-input bg-background pl-8 pr-8 text-xs sm:text-sm font-medium text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-70",
            compact ? "h-8" : "h-9",
            selectedWarehouseId && "border-primary/40 bg-primary/[0.03]"
          )}
        >
          <option value="">{allLabel}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2.5 flex items-center">
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>
      )}
    </>

  )
}
