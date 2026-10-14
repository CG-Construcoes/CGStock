"use client"

import { useTransition } from "react"
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
}

export function WarehouseSelectFilter({
  warehouses,
  selectedWarehouseId,
  paramName = "warehouseId",
  syncGlobalCookie = true,
  allLabel = "Todos os Almoxarifados",
  className,
  compact = false,
}: WarehouseSelectFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Se o usuário só tem acesso a 1 almoxarifado, exibe apenas o badge informativo (ou oculta o dropdown de troca)
  if (warehouses.length === 0) return null

  if (warehouses.length === 1) {
    const single = warehouses[0]
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
    startTransition(async () => {
      if (syncGlobalCookie) {
        await setActiveWarehouseAction(newWarehouseId)
      }

      const params = new URLSearchParams(searchParams.toString())
      if (params.has(paramName)) {
        if (newWarehouseId) {
          params.set(paramName, newWarehouseId)
        } else {
          params.delete(paramName)
        }
      } else if (!syncGlobalCookie) {
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
      router.push(queryStr ? `${pathname}?${queryStr}` : pathname)
      router.refresh()
    })
  }

  return (
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
  )
}
