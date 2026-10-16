"use client"

import { useState, useRef, useEffect } from "react"
import { Boxes, ChevronDown, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { formatNumber, cn } from "@/lib/utils"

export interface UnitVolumeStat {
  key: string
  code: string
  label: string
  physical: number
  available: number
  reserved: number
  skuCount: number
}

interface PhysicalVolumeCardProps {
  unitStats: UnitVolumeStat[]
  totalPhysical: number
  totalAvailable: number
  totalReserved: number
  totalSkus: number
}

export function PhysicalVolumeCard({
  unitStats,
  totalPhysical,
  totalAvailable,
  totalReserved,
  totalSkus,
}: PhysicalVolumeCardProps) {
  const [selectedKey, setSelectedKey] = useState<string>("ALL")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const allOption: UnitVolumeStat = {
    key: "ALL",
    code: "total",
    label: "Todas as medidas (Soma Geral)",
    physical: totalPhysical,
    available: totalAvailable,
    reserved: totalReserved,
    skuCount: totalSkus,
  }

  const options = [allOption, ...unitStats]
  const current = options.find((o) => o.key === selectedKey) || allOption

  return (
    <div ref={containerRef} className="relative h-full">
      <Card
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "rounded-md border-border bg-card shadow-sm hover:border-blue-500/60 hover:shadow-md transition-all cursor-pointer h-full group/card select-none",
          open && "border-blue-500 ring-2 ring-blue-500/20"
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-1 min-w-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover/card:text-foreground transition-colors truncate">
              Volume Físico Total
            </CardTitle>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen((prev) => !prev)
              }}
              title="Escolher unidade de medida (UN, KG, Volume, Outros)"
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 text-[10px] font-bold uppercase transition-colors shrink-0"
            >
              <span>{current.key === "ALL" ? "Geral" : current.code}</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </button>
            <div onClick={(e) => e.stopPropagation()}>
              <InfoTooltip
                title="Volume Físico por Unidade e Medida"
                text="Clique na seta para alternar a visualização entre o total geral, Unidades (UN), Peso (KG), Volume/Comprimento (L, M, M³) ou outras medidas."
              />
            </div>
          </div>
          <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500 shrink-0">
            <Boxes className="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>

        <CardContent>
          <div className="text-2xl font-black text-foreground inline-flex items-baseline gap-1.5 flex-wrap">
            <span>{formatNumber(current.physical)}</span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">
              {current.code.toLowerCase()}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xs text-muted-foreground truncate">
              {formatNumber(current.available)} disponíveis • {formatNumber(current.reserved)} reservadas
            </p>
            <span className="text-[10px] font-medium text-muted-foreground/70 group-hover/card:text-blue-500 transition-colors shrink-0">
              {current.skuCount} {current.skuCount === 1 ? "item" : "itens"}
            </span>
          </div>
        </CardContent>
      </Card>

      {open && (
        <div
          role="listbox"
          aria-label="Selecionar unidade de medida"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 rounded-md border border-border bg-card p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 mb-1">
            Filtrar volume por medida
          </div>
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.key === current.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedKey(opt.key)
                    setOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded text-left text-xs transition-colors",
                    isSelected
                      ? "bg-blue-500/15 text-blue-500 font-semibold"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isSelected ? "opacity-100 text-blue-500" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                    <span className="font-bold">{formatNumber(opt.physical)}</span>
                    <span className="text-muted-foreground uppercase">{opt.code}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
