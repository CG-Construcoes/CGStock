"use client"

import React, { createContext, useContext, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface StockTransitionContextType {
  isPending: boolean
  startTransition: (callback: () => void) => void
  loadingWarehouseName: string | null
  setLoadingWarehouseName: (name: string | null) => void
}

const StockTransitionContext = createContext<StockTransitionContextType>({
  isPending: false,
  startTransition: () => {},
  loadingWarehouseName: null,
  setLoadingWarehouseName: () => {},
})

export function StockTransitionProvider({ children }: { children: React.ReactNode }) {
  const [isPending, startTransition] = useTransition()
  const [loadingWarehouseName, setLoadingWarehouseName] = useState<string | null>(null)

  return (
    <StockTransitionContext.Provider
      value={{
        isPending,
        startTransition,
        loadingWarehouseName,
        setLoadingWarehouseName,
      }}
    >
      {children}
    </StockTransitionContext.Provider>
  )
}

export function useStockTransition() {
  return useContext(StockTransitionContext)
}

export function StockContentWrapper({ children }: { children: React.ReactNode }) {
  const { isPending, loadingWarehouseName } = useStockTransition()

  return (
    <div className="relative min-h-[300px]">
      {/* Loading Overlay */}
      {isPending && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-30 flex items-start justify-center pt-24 bg-background/50 backdrop-blur-[2px] rounded-md transition-all duration-300"
        >
          <div className="sticky top-28 flex items-center gap-3 bg-card border border-primary/40 shadow-xl px-5 py-3 rounded-full text-foreground backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {loadingWarehouseName
                ? `Carregando "${loadingWarehouseName}"...`
                : "Atualizando dados do estoque..."}
            </span>
          </div>
        </div>
      )}

      {/* Main Content with soft opacity during transition */}
      <div
        className={cn(
          "transition-all duration-200",
          isPending && "opacity-40 pointer-events-none select-none filter blur-[0.4px]"
        )}
      >
        {children}
      </div>
    </div>
  )
}
