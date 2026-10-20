"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import {
  Printer,
  ArrowLeft,
  Package,
  Layers,
  Settings2,
  CheckCircle2,
  Sliders,
  Plus,
  Minus,
  RotateCcw,
  Scissors,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export type ProductLabelItem = {
  id: string
  code: string
  name: string
  barcode: string | null
  brand: string | null
  model: string | null
  averageCost: number | null
  status: string
  categoryName: string
  unitCode: string
  totalStock: number
  warehouses: string[]
}

type GridPreset = "GRID_9" | "GRID_12" | "GRID_6" | "THERMAL"

export function PrintLabelsClient({
  products,
  isFiltered,
  totalCount,
}: {
  products: ProductLabelItem[]
  isFiltered: boolean
  totalCount: number
}) {
  const [gridPreset, setGridPreset] = useState<GridPreset>("GRID_9")
  const [showCutGuides, setShowCutGuides] = useState<boolean>(true)

  // Map of copies per product ID
  const [copiesMap, setCopiesMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    products.forEach((p) => {
      initial[p.id] = 1
    })
    return initial
  })

  // Visual options toggles
  const [showCategory, setShowCategory] = useState(true)
  const [showUnit, setShowUnit] = useState(true)
  const [showPrice, setShowPrice] = useState(false)
  const [showHumanCode, setShowHumanCode] = useState(true)

  // Drawer / editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  // Apply copy strategy
  const setAllCopies = (count: number) => {
    const updated: Record<string, number> = {}
    products.forEach((p) => {
      updated[p.id] = count
    })
    setCopiesMap(updated)
  }

  const setCopiesByStock = () => {
    const updated: Record<string, number> = {}
    products.forEach((p) => {
      updated[p.id] = Math.max(1, Math.min(p.totalStock, 100))
    })
    setCopiesMap(updated)
  }

  const updateProductCopy = (id: string, delta: number) => {
    setCopiesMap((prev) => {
      const current = prev[id] ?? 1
      const next = Math.max(0, current + delta)
      return { ...prev, [id]: next }
    })
  }

  // Expanded list of labels to render
  const labelsToPrint = useMemo(() => {
    const list: { product: ProductLabelItem; copyIndex: number; totalCopies: number }[] = []
    for (const p of products) {
      const copies = copiesMap[p.id] ?? 0
      for (let i = 0; i < copies; i++) {
        list.push({ product: p, copyIndex: i + 1, totalCopies: copies })
      }
    }
    return list
  }, [products, copiesMap])

  useEffect(() => {
    let prevTitle = ""
    const handleBeforePrint = () => {
      prevTitle = document.title
      document.title = ""
    }
    const handleAfterPrint = () => {
      if (prevTitle) {
        document.title = prevTitle
      }
    }
    window.addEventListener("beforeprint", handleBeforePrint)
    window.addEventListener("afterprint", handleAfterPrint)
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint)
      window.removeEventListener("afterprint", handleAfterPrint)
    }
  }, [])

  const handlePrint = () => {
    const prevTitle = document.title
    document.title = ""
    window.print()
    setTimeout(() => {
      document.title = prevTitle
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-foreground print:bg-white print:text-black print:m-0 print:p-0">
      {/* Barra de Controles Superior - Oculta na Impressão */}
      <header className="print:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          {/* Título & Voltar */}
          <div className="flex items-center gap-3">
            <Link href="/products">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Impressão de Etiquetas de Produtos (QR Code)
              </h1>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{labelsToPrint.length}</strong> etiqueta(s) a imprimir para{" "}
                <strong className="text-foreground">{products.length}</strong> produto(s) diferentes{" "}
                {isFiltered ? "(seleção personalizada)" : `(de ${totalCount} produtos no catálogo)`}
              </p>
            </div>
          </div>

          {/* Barra de Opções e Configurações */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Modelo / Grade */}
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs">
              <button
                onClick={() => setGridPreset("GRID_9")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  gridPreset === "GRID_9"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="3 colunas x 3 linhas = 9 por folha A4. Tamanho grande, fácil de cortar com tesoura"
              >
                9 por folha (3x3 - Grande) ⭐
              </button>
              <button
                onClick={() => setGridPreset("GRID_12")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  gridPreset === "GRID_12"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="3 colunas x 4 linhas = 12 por folha A4. Tamanho médio para caixas e prateleiras"
              >
                12 por folha (3x4 - Médio)
              </button>
              <button
                onClick={() => setGridPreset("GRID_6")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  gridPreset === "GRID_6"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="2 colunas x 3 linhas = 6 por folha A4. Gôndola / Prateleira grande"
              >
                6 por folha (2x3 - Gôndola)
              </button>
              <button
                onClick={() => setGridPreset("THERMAL")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  gridPreset === "THERMAL"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Bobina contínua para impressora térmica (Argox, Zebra)"
              >
                Térmica (1 Coluna)
              </button>
            </div>

            {/* Toggle Linhas para Tesoura */}
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 text-xs text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showCutGuides}
                onChange={(e) => setShowCutGuides(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Linhas para Tesoura</span>
            </label>

            {/* Botão de Gestão de Quantidades */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditorOpen(!isEditorOpen)}
              className="gap-1.5 text-xs font-medium"
            >
              <Sliders className="h-3.5 w-3.5" />
              {isEditorOpen ? "Fechar Quantidades" : "Ajustar Cópias"}
            </Button>

            {/* Botão Imprimir */}
            <Button
              onClick={handlePrint}
              disabled={labelsToPrint.length === 0}
              className="gap-2 bg-primary text-primary-foreground font-semibold shadow-sm active:scale-95"
            >
              <Printer className="h-4 w-4" />
              Imprimir Agora ({labelsToPrint.length})
            </Button>
          </div>
        </div>
      </header>

      {/* Editor de Quantidades & Toggles (Painel Recolhível) */}
      <div className="print:hidden max-w-7xl mx-auto px-4 pt-4 space-y-3">
        {/* Banner de Dica de Impressão */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            💡 <strong>Configuração Recomendada da Impressora:</strong> Defina <strong>Margens como "Mínimas" ou "Nenhuma"</strong> e marque <strong>"Gráficos de segundo plano"</strong> para que as linhas de corte e o contraste preto e branco saiam 100% nítidos.
          </span>
          <span className="font-mono text-[11px] shrink-0 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
            Papel A4 {gridPreset === "GRID_9" ? "(9 por folha)" : gridPreset === "GRID_12" ? "(12 por folha)" : ""}
          </span>
        </div>

        {/* Painel de Quantidades se Aberto */}
        {isEditorOpen && (
          <div className="p-4 rounded-xl border border-border bg-card shadow-md space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  Gerenciador de Cópias por Produto
                </h3>
                <p className="text-xs text-muted-foreground">
                  Escolha quantas etiquetas deseja imprimir de cada item ou aplique uma regra em massa.
                </p>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAllCopies(1)}
                  className="h-7 text-xs"
                >
                  1 de Cada
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAllCopies(2)}
                  className="h-7 text-xs"
                >
                  2 de Cada
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={setCopiesByStock}
                  className="h-7 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  title="Gera a quantidade exata de etiquetas igual ao saldo em estoque (máx 100)"
                >
                  Pelo Saldo em Estoque
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAllCopies(0)}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  Zerar Todas
                </Button>
              </div>
            </div>

            {/* Toggles de Exibição */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-b border-border pb-3">
              <span className="font-semibold text-foreground">Exibir nas etiquetas:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCategory}
                  onChange={(e) => setShowCategory(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Categoria
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUnit}
                  onChange={(e) => setShowUnit(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Unidade (UN, KG, MT...)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHumanCode}
                  onChange={(e) => setShowHumanCode(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Cód. Insumo legível abaixo
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Custo Médio
              </label>
            </div>

            {/* Lista dos Produtos para Ajuste Fino */}
            <div className="max-h-60 overflow-y-auto divide-y divide-border border rounded-lg bg-background">
              {products.map((p) => {
                const copies = copiesMap[p.id] ?? 0
                return (
                  <div
                    key={p.id}
                    className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px]">
                          {p.code}
                        </span>
                        <span className="font-semibold text-foreground truncate">{p.name}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {p.categoryName} · {p.unitCode} · Estoque atual: <strong>{p.totalStock}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateProductCopy(p.id, -1)}
                        disabled={copies <= 0}
                        className="h-7 w-7"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-mono font-bold text-sm">{copies}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateProductCopy(p.id, 1)}
                        className="h-7 w-7"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Área Imprimível (A4 / Térmica) */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 print:p-[8mm] print:m-0 print:max-w-none print:w-full">
        {labelsToPrint.length === 0 ? (
          <div className="py-20 text-center bg-card rounded-xl border border-dashed border-border p-8 print:hidden">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-bold text-lg text-foreground">Nenhuma etiqueta selecionada</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Todas as cópias foram definidas como 0 ou nenhum produto foi selecionado. Clique em "Ajustar Cópias" acima para definir as quantidades.
            </p>
            <Button
              onClick={() => setAllCopies(1)}
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar 1 Etiqueta por Produto
            </Button>
          </div>
        ) : (
          <div
            className={`grid justify-center ${
              gridPreset === "GRID_9"
                ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-3 print:gap-[2.5mm]"
                : gridPreset === "GRID_12"
                ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-2.5 print:gap-[2mm]"
                : gridPreset === "GRID_6"
                ? "grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-[4mm]"
                : "grid-cols-1 print:grid-cols-1 gap-3 print:gap-[3mm]"
            }`}
          >
            {labelsToPrint.map(({ product, copyIndex, totalCopies }, idx) => {
              const qrValue = product.code

              // MODELO 9 POR PÁGINA (3x3 - Grande, Ideal para Tesoura)
              if (gridPreset === "GRID_9") {
                return (
                  <div
                    key={`${product.id}-${copyIndex}-${idx}`}
                    className={`bg-white text-slate-950 p-2 sm:p-2.5 flex flex-col justify-between text-center relative break-inside-avoid print:break-inside-avoid ${
                      showCutGuides
                        ? "border-2 border-dashed border-slate-400 print:border-slate-800 rounded-lg"
                        : "border-2 border-slate-900 rounded-lg"
                    }`}
                    style={{ minHeight: "185px", height: "auto" }}
                  >
                    {/* Marcador de tesoura */}
                    {showCutGuides && (
                      <div className="absolute top-0 left-2.5 -translate-y-1/2 bg-white px-1.5 text-[8px] text-slate-500 print:text-black flex items-center gap-1 z-10 pointer-events-none rounded">
                        <Scissors className="h-2.5 w-2.5" />
                        <span className="text-[7px] font-mono font-bold uppercase tracking-wider">corte</span>
                      </div>
                    )}

                    {/* Cabeçalho */}
                    <div className="w-full border-b border-slate-300 pb-1 mb-1.5 flex items-center justify-between px-1 pt-0.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                        CG CONSTRUÇÕES
                      </span>
                      <span className="text-[9px] font-mono font-bold text-slate-600">
                        CGSTOCK
                      </span>
                    </div>

                    {/* Conteúdo Central: QR Code + Detalhes */}
                    <div className="flex items-center gap-2 w-full justify-start my-auto overflow-hidden">
                      <div className="p-1 bg-white rounded border border-slate-300 shrink-0">
                        <QRCodeSVG
                          value={qrValue}
                          size={64}
                          level="M"
                          includeMargin={false}
                        />
                      </div>

                      <div className="text-left flex-1 min-w-0 pl-1 flex flex-col justify-center overflow-hidden">
                        <div className="inline-flex items-center font-mono text-[9.5px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide mb-1 self-start whitespace-nowrap leading-none">
                          {product.code}
                        </div>

                        <div className="font-bold text-[11px] leading-tight text-slate-950 break-words line-clamp-3">
                          {product.name}
                        </div>

                        <div className="flex flex-wrap items-center gap-1 text-[8.5px] text-slate-700 font-medium mt-1">
                          {showUnit && (
                            <span className="font-bold bg-slate-100 border border-slate-300 px-1 rounded text-slate-900">
                              {product.unitCode}
                            </span>
                          )}
                          {showCategory && (
                            <span className="truncate max-w-[100px]">{product.categoryName}</span>
                          )}
                        </div>

                        {showPrice && product.averageCost && (
                          <div className="text-[8.5px] font-mono font-bold text-slate-700 mt-0.5">
                            R$ {product.averageCost.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rodapé */}
                    <div className="w-full border-t border-slate-200 pt-1 mt-1 flex items-center justify-between text-[8px] font-mono text-slate-600 px-1">
                      {showHumanCode && <span className="font-bold truncate max-w-[100px]">{qrValue}</span>}
                      <span className="text-[8px] uppercase font-bold text-slate-700 ml-auto">
                        {totalCopies > 1 ? `VIA ${copyIndex}/${totalCopies}` : "PROPRIEDADE CG"}
                      </span>
                    </div>
                  </div>
                )
              }

              // MODELO 12 POR PÁGINA (3x4 - Médio)
              if (gridPreset === "GRID_12") {
                return (
                  <div
                    key={`${product.id}-${copyIndex}-${idx}`}
                    className={`bg-white text-slate-950 p-2 flex flex-col justify-between text-center relative break-inside-avoid print:break-inside-avoid ${
                      showCutGuides
                        ? "border border-dashed border-slate-400 print:border-slate-800 rounded-md"
                        : "border-2 border-slate-900 rounded-md"
                    }`}
                    style={{ minHeight: "160px" }}
                  >
                    {/* Marcador de tesoura */}
                    {showCutGuides && (
                      <div className="absolute -top-1.5 left-2 bg-white px-1 text-[8px] text-slate-500 print:text-black flex items-center gap-0.5">
                        <Scissors className="h-2 w-2" />
                      </div>
                    )}

                    <div className="w-full border-b border-slate-300 pb-0.5 mb-1 flex items-center justify-between px-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-800">
                        CG CONSTRUÇÕES
                      </span>
                      <span className="text-[8px] font-mono font-bold text-slate-600">
                        CGSTOCK
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-full justify-center my-auto">
                      <div className="p-0.5 bg-white rounded border border-slate-300 shrink-0">
                        <QRCodeSVG
                          value={qrValue}
                          size={66}
                          level="H"
                          includeMargin={false}
                        />
                      </div>

                      <div className="text-left flex-1 min-w-0">
                        <div className="inline-block font-mono text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide mb-0.5">
                          {product.code}
                        </div>
                        <div className="font-bold text-[11px] leading-tight line-clamp-2 text-slate-950">
                          {product.name}
                        </div>
                        <div className="flex items-center gap-1 text-[8px] text-slate-600 mt-0.5">
                          {showUnit && <span className="font-bold">{product.unitCode}</span>}
                          {showCategory && <span className="truncate">· {product.categoryName}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="w-full border-t border-slate-200 pt-0.5 mt-0.5 flex items-center justify-between text-[7px] font-mono text-slate-500 px-1">
                      <span className="truncate">{qrValue}</span>
                      <span className="uppercase font-bold text-slate-700">PRODUTO</span>
                    </div>
                  </div>
                )
              }

              // MODELO 6 POR PÁGINA (2x3 - Gôndola / Prateleira Grande)
              if (gridPreset === "GRID_6") {
                return (
                  <div
                    key={`${product.id}-${copyIndex}-${idx}`}
                    className={`bg-white text-slate-950 p-3.5 flex flex-col justify-between relative break-inside-avoid print:break-inside-avoid ${
                      showCutGuides
                        ? "border-2 border-dashed border-slate-400 print:border-slate-800 rounded-xl"
                        : "border-2 border-slate-900 rounded-xl"
                    }`}
                    style={{ minHeight: "230px" }}
                  >
                    {showCutGuides && (
                      <div className="absolute -top-2 left-3 bg-white px-1 text-[9px] text-slate-500 print:text-black flex items-center gap-0.5">
                        <Scissors className="h-2.5 w-2.5" />
                        <span className="text-[8px] font-mono">corte</span>
                      </div>
                    )}

                    <div className="border-b border-slate-300 pb-1 mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                          CG CONSTRUÇÕES
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium">· ALMOXARIFADO</span>
                      </div>
                      <span className="text-[9px] font-mono font-extrabold text-slate-700">
                        CGSTOCK
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-1 my-auto">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-mono text-lg font-black text-slate-950 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded inline-block tracking-tight mb-1.5">
                          {product.code}
                        </div>

                        <div className="font-bold text-sm leading-tight text-slate-950 line-clamp-2">
                          {product.name}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-600 mt-2 font-medium">
                          {showCategory && (
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {product.categoryName}
                            </span>
                          )}
                          {showUnit && (
                            <span className="bg-slate-900 text-white font-mono font-bold px-1.5 py-0.5 rounded">
                              {product.unitCode}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-1.5 bg-white rounded border border-slate-300 shrink-0">
                        <QRCodeSVG
                          value={qrValue}
                          size={92}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-1 mt-2 flex items-center justify-between text-[8px] font-mono text-slate-500">
                      <span>BIPE COM SCANNER OU CÂMERA</span>
                      <span className="font-bold">{qrValue}</span>
                    </div>
                  </div>
                )
              }

              // MODELO TÉRMICO (1 Coluna)
              return (
                <div
                  key={`${product.id}-${copyIndex}-${idx}`}
                  className="bg-white text-slate-950 border-2 border-slate-900 rounded-lg p-2.5 flex flex-col items-center justify-between text-center break-inside-avoid print:break-inside-avoid w-full max-w-xs mx-auto"
                  style={{ minHeight: "150px" }}
                >
                  <div className="w-full border-b border-slate-300 pb-1 mb-1 flex items-center justify-between">
                    <span className="text-[9px] font-black">CG CONSTRUÇÕES</span>
                    <span className="text-[8px] font-mono">CGSTOCK</span>
                  </div>
                  <div className="flex items-center gap-2 w-full justify-center my-1">
                    <QRCodeSVG value={qrValue} size={70} level="H" />
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-mono text-xs font-black bg-slate-900 text-white px-1.5 py-0.5 rounded inline-block mb-1">
                        {product.code}
                      </div>
                      <div className="font-bold text-xs leading-tight line-clamp-2">{product.name}</div>
                      <div className="text-[9px] text-slate-500">{product.unitCode}</div>
                    </div>
                  </div>
                  <div className="w-full border-t border-slate-200 pt-1 text-[8px] font-mono text-slate-500">
                    {qrValue}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Regras CSS Específicas de Impressão */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            margin: 0 !important;
            size: ${gridPreset === "THERMAL" ? "auto" : "A4 portrait"};
          }
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `,
        }}
      />
    </div>
  )
}
