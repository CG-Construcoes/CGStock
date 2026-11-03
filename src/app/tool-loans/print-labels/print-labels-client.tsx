"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import {
  Printer,
  ArrowLeft,
  Wrench,
  Plus,
  Minus,
  Scissors,
  Sliders,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export type ToolLabelItem = {
  id: string
  code: string
  qrToken: string
  name: string
  category: string | null
  brand: string | null
  trackingType: "ASSET" | "QUANTITY"
  totalQuantity: number
  unit: string
  warehouseName: string
  warehouseCode: string
}

type GridPreset = "GRID_9" | "GRID_12" | "GRID_6" | "THERMAL"

export function PrintToolLabelsClient({ tools }: { tools: ToolLabelItem[] }) {
  const [gridPreset, setGridPreset] = useState<GridPreset>("GRID_9")
  const [showCutGuides, setShowCutGuides] = useState(true)
  const [showCategory, setShowCategory] = useState(true)
  const [showWarehouse, setShowWarehouse] = useState(true)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  const [copiesMap, setCopiesMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    tools.forEach((t) => {
      initial[t.id] = 1
    })
    return initial
  })

  const updateCopies = (id: string, delta: number) => {
    setCopiesMap((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(50, (prev[id] ?? 1) + delta)),
    }))
  }

  const setAllCopies = (count: number) => {
    const next: Record<string, number> = {}
    tools.forEach((t) => {
      next[t.id] = count
    })
    setCopiesMap(next)
  }

  const expandedLabels = useMemo(() => {
    const list: { tool: ToolLabelItem; copyIndex: number }[] = []
    tools.forEach((tool) => {
      const count = copiesMap[tool.id] ?? 1
      for (let i = 0; i < count; i++) {
        list.push({ tool, copyIndex: i + 1 })
      }
    })
    return list
  }, [tools, copiesMap])

  const getGridClasses = () => {
    switch (gridPreset) {
      case "GRID_6":
        return "grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-3"
      case "GRID_9":
        return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 gap-3 print:gap-2.5"
      case "GRID_12":
        return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 gap-2.5 print:gap-2"
      case "THERMAL":
        return "grid-cols-1 max-w-xs mx-auto gap-3 print:gap-2"
    }
  }

  const getQrSize = () => {
    switch (gridPreset) {
      case "GRID_6":
        return 112
      case "GRID_9":
        return 88
      case "GRID_12":
        return 68
      case "THERMAL":
        return 120
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Barra de controle (oculta na impressão) */}
      <div className="print:hidden sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/tool-loans">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar à Ferramentaria
                </Button>
              </Link>
              <div>
                <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Etiquetas QR Code — Ferramentaria
                </h1>
                <p className="text-xs text-muted-foreground">
                  {expandedLabels.length} etiqueta(s) pronta(s) para impressão ({tools.length} ferramenta(s))
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditorOpen(!isEditorOpen)}
                className="h-10 sm:h-9 gap-1.5 w-full sm:w-auto"
              >
                <Sliders className="h-4 w-4" />
                Cópias ({expandedLabels.length})
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => window.print()}
                className="h-10 sm:h-9 gap-1.5 w-full sm:w-auto"
              >
                <Printer className="h-4 w-4" />
                Imprimir Etiquetas
              </Button>
            </div>
          </div>

          {/* Opções de Layout */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-muted-foreground mr-1">Formato:</span>
              {(
                [
                  { id: "GRID_6", label: "Grande (2 col)" },
                  { id: "GRID_9", label: "Padrão A4 (3 col)" },
                  { id: "GRID_12", label: "Compacta (4 col)" },
                  { id: "THERMAL", label: "Rolo Térmico" },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setGridPreset(preset.id)}
                  className={`px-2.5 py-1 rounded-md border font-medium transition-colors ${
                    gridPreset === preset.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCutGuides}
                  onChange={(e) => setShowCutGuides(e.target.checked)}
                />
                <Scissors className="h-3.5 w-3.5" /> Guias de corte
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCategory}
                  onChange={(e) => setShowCategory(e.target.checked)}
                />
                Categoria
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWarehouse}
                  onChange={(e) => setShowWarehouse(e.target.checked)}
                />
                Almoxarifado
              </label>
            </div>
          </div>

          {/* Editor de cópias por ferramenta */}
          {isEditorOpen && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 max-h-56 overflow-y-auto">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                <span className="font-semibold">Quantidade de etiquetas por ferramenta</span>
                <div className="flex gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAllCopies(1)}>
                    1 cópia de cada
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAllCopies(2)}>
                    2 cópias de cada
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {tools.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-primary">{t.code}</span>{" "}
                      <span className="truncate">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCopies(t.id, -1)}
                        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-bold">{copiesMap[t.id] ?? 1}</span>
                      <button
                        type="button"
                        onClick={() => updateCopies(t.id, 1)}
                        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Área de Impressão */}
      <div className="max-w-5xl mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
        {expandedLabels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-2 print:hidden">
            <Wrench className="h-10 w-10 text-muted-foreground/50 mx-auto" />
            <p className="font-semibold">Nenhuma ferramenta selecionada para impressão</p>
            <p className="text-xs text-muted-foreground">
              Volte à Ferramentaria e cadastre ou selecione as ferramentas que deseja imprimir.
            </p>
          </div>
        ) : (
          <div className={`grid ${getGridClasses()}`}>
            {expandedLabels.map(({ tool, copyIndex }) => (
              <div
                key={`${tool.id}-${copyIndex}`}
                className={`bg-white text-slate-900 rounded-lg p-3 flex items-center gap-3 break-inside-avoid ${
                  showCutGuides
                    ? "border-2 border-dashed border-slate-300"
                    : "border border-slate-200"
                }`}
              >
                <div className="shrink-0 bg-white p-1 rounded border border-slate-200">
                  <QRCodeSVG
                    value={tool.qrToken}
                    size={getQrSize()}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded bg-slate-900 text-white">
                      {tool.code}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      PATRIMÔNIO · QTD {tool.totalQuantity}
                    </span>
                  </div>
                  <p className="font-bold text-xs sm:text-sm text-slate-900 leading-tight line-clamp-2">
                    {tool.name}
                  </p>
                  {showCategory && (tool.category || tool.brand) && (
                    <p className="text-[10px] text-slate-600 truncate">
                      {[tool.category, tool.brand].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {showWarehouse && (
                    <p className="text-[10px] font-semibold text-slate-500 truncate">
                      {tool.warehouseCode} — {tool.warehouseName}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
