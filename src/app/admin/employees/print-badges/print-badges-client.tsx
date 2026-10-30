"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import {
  Printer,
  ArrowLeft,
  HardHat,
  Scissors,
  CheckCircle2,
  Sparkles,
  Sliders,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type PrintEmployee = {
  id: string
  name: string
  employeeCode: string | null
  document: string | null
  phone: string | null
  email: string | null
  qrToken: string | null
  warehouseAccesses: {
    warehouse: { name: string; code: string }
  }[]
}

type GridPreset = "GRID_9" | "GRID_8" | "GRID_12" | "GRID_6" | "THERMAL"

export function PrintBadgesClient({
  employees,
  isFiltered,
  totalActive,
}: {
  employees: PrintEmployee[]
  isFiltered: boolean
  totalActive: number
}) {
  const [gridPreset, setGridPreset] = useState<GridPreset>("GRID_9")
  const [showCutGuides, setShowCutGuides] = useState<boolean>(true)
  const [copiesPerEmployee, setCopiesPerEmployee] = useState<number>(1)

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

  const formatCpf = (cpf?: string | null) => {
    if (!cpf) return ""
    const clean = cpf.replace(/\D/g, "")
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`
    }
    return cpf
  }

  const formatPhone = (phone?: string | null) => {
    if (!phone) return ""
    const clean = phone.replace(/\D/g, "")
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
    }
    if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
    }
    return phone
  }

  // Multiplicador de etiquetas (ex: 1 para o capacete principal, 2 se precisar de reserva/crachá)
  const expandedList = employees.flatMap((emp) =>
    Array.from({ length: copiesPerEmployee }, (_, i) => ({
      employee: emp,
      copyIndex: i + 1,
    }))
  )

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-foreground print:bg-white print:text-black print:m-0 print:p-0">
      {/* Barra de Controles Superior - Oculta na Impressão */}
      <header className="print:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/employees">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <HardHat className="h-5 w-5 text-primary" />
                Impressão de Etiquetas de Capacete & Crachás
              </h1>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{expandedList.length}</strong> etiqueta(s) a imprimir{" "}
                {isFiltered ? "(seleção personalizada)" : `(de ${totalActive} colaboradores ativos)`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Modelo / Grade por Página */}
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs">
              <button
                onClick={() => setGridPreset("GRID_9")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  gridPreset === "GRID_9"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="3 colunas x 3 linhas = 9 por folha A4. Tamanho padrão para capacetes"
              >
                9 por folha (3x3) ⭐
              </button>
              <button
                onClick={() => setGridPreset("GRID_8")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  gridPreset === "GRID_8"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="2 colunas x 4 linhas = 8 por folha A4. Modelo largo/horizontal ideal para a curvatura do capacete"
              >
                8 por folha (2x4 - Largo)
              </button>
              <button
                onClick={() => setGridPreset("GRID_12")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  gridPreset === "GRID_12"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="3 colunas x 4 linhas = 12 por folha A4. Tamanho compacto"
              >
                12 por folha (3x4)
              </button>
              <button
                onClick={() => setGridPreset("GRID_6")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  gridPreset === "GRID_6"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="2 colunas x 3 linhas = 6 por folha A4. Crachá vertical extra grande"
              >
                6 por folha (2x3 - Crachá)
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

            {/* Toggle Guias de Corte para Tesoura */}
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

            {/* Cópias por Funcionário */}
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs">
              <span className="px-2 text-muted-foreground">Cópias:</span>
              <button
                onClick={() => setCopiesPerEmployee(1)}
                className={`px-2 py-0.5 rounded font-medium ${
                  copiesPerEmployee === 1 ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                1
              </button>
              <button
                onClick={() => setCopiesPerEmployee(2)}
                className={`px-2 py-0.5 rounded font-medium ${
                  copiesPerEmployee === 2 ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
                title="2 etiquetas por funcionário (ex: capacete principal + reserva)"
              >
                2
              </button>
            </div>

            <Button
              onClick={handlePrint}
              className="gap-2 bg-primary text-primary-foreground font-semibold shadow-sm active:scale-95"
            >
              <Printer className="h-4 w-4" />
              Imprimir Agora ({expandedList.length})
            </Button>
          </div>
        </div>
      </header>

      {/* Dica de Impressão na Tela */}
      <div className="print:hidden max-w-7xl mx-auto px-4 pt-4">
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            💡 <strong>Configuração Recomendada da Impressora:</strong> Defina <strong>Margens como "Mínimas" ou "Nenhuma"</strong> e marque <strong>"Gráficos de segundo plano"</strong> para que as linhas de corte e o contraste preto e branco saiam 100% nítidos.
          </span>
          <span className="font-mono text-[11px] shrink-0 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
            {gridPreset === "GRID_9" ? "Papel A4 (9 por folha)" : gridPreset === "GRID_8" ? "Papel A4 (8 por folha)" : gridPreset === "GRID_12" ? "Papel A4 (12 por folha)" : gridPreset === "GRID_6" ? "Papel A4 (6 por folha)" : "Rolo Térmico"}
          </span>
        </div>
      </div>

      {/* Área Imprimível */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 print:p-[8mm] print:m-0 print:max-w-none print:w-full">
        <div
          className={`grid justify-center ${
            gridPreset === "GRID_9"
              ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-3 print:gap-[2.5mm]"
              : gridPreset === "GRID_8"
              ? "grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3.5 print:gap-[3mm]"
              : gridPreset === "GRID_12"
              ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-2.5 print:gap-[2mm]"
              : gridPreset === "GRID_6"
              ? "grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-[4mm]"
              : "grid-cols-1 print:grid-cols-1 gap-3 print:gap-[3mm]"
          }`}
        >
          {expandedList.map(({ employee: emp, copyIndex }, idx) => {
            const qrValue = emp.qrToken || (emp.employeeCode ? `EMP-${emp.employeeCode}` : emp.id)
            const cpfFormatted = formatCpf(emp.document)

            // GRADE 9 POR PÁGINA (3x3 - Padrão)
            if (gridPreset === "GRID_9") {
              return (
                <div
                  key={`${emp.id}-${copyIndex}-${idx}`}
                  className={`bg-white text-slate-950 p-2 sm:p-2.5 px-3 flex flex-col justify-between text-center relative break-inside-avoid print:break-inside-avoid ${
                    showCutGuides
                      ? "border-2 border-dashed border-slate-400 print:border-slate-800 rounded-lg"
                      : "border-2 border-slate-900 rounded-lg"
                  }`}
                  style={{ minHeight: "185px", height: "auto" }}
                >
                  {/* Marcador de tesoura no topo */}
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

                  {/* Conteúdo Central: Centralizado e com folga da borda direita */}
                  <div className="flex items-center justify-center gap-2.5 w-full my-auto overflow-hidden px-1">
                    <div className="p-1 bg-white rounded border border-slate-300 shrink-0">
                      <QRCodeSVG
                        value={qrValue}
                        size={60}
                        level="M"
                        includeMargin={false}
                      />
                    </div>

                    <div className="text-left flex-1 min-w-0 pr-1 flex flex-col justify-center overflow-hidden">
                      {emp.employeeCode && (
                        <div className="inline-flex items-center font-mono text-[9.5px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide mb-1 self-start whitespace-nowrap leading-none">
                          MAT: {emp.employeeCode}
                        </div>
                      )}
                      <div className="font-bold text-[10.5px] leading-tight text-slate-950 break-words line-clamp-3">
                        {emp.name}
                      </div>
                      {cpfFormatted && (
                        <div className="font-mono text-[8.5px] text-slate-900 mt-1 font-bold whitespace-nowrap tracking-tight leading-none flex items-center">
                          <span className="font-sans text-[7px] font-semibold text-slate-500 mr-1 uppercase">CPF:</span>
                          <span>{cpfFormatted}</span>
                        </div>
                      )}
                      {emp.phone && (
                        <div className="font-mono text-[8px] text-slate-600 mt-1 whitespace-nowrap leading-none">
                          {formatPhone(emp.phone)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rodapé com Código do Token para Bipe Manual */}
                  <div className="w-full border-t border-slate-200 pt-1 mt-1.5 flex items-center justify-between text-[8px] font-mono text-slate-600 px-1">
                    <span className="truncate max-w-[110px] font-bold">{qrValue}</span>
                    <span className="text-[8px] uppercase font-bold text-slate-700 whitespace-nowrap">EPI / CAPACETE</span>
                  </div>
                </div>
              )
            }

            // GRADE 8 POR PÁGINA (2x4 - Largo / Horizontal ideal para capacete)
            if (gridPreset === "GRID_8") {
              return (
                <div
                  key={`${emp.id}-${copyIndex}-${idx}`}
                  className={`bg-white text-slate-950 p-2.5 sm:p-3 flex flex-col justify-between text-center relative break-inside-avoid print:break-inside-avoid ${
                    showCutGuides
                      ? "border-2 border-dashed border-slate-400 print:border-slate-800 rounded-lg"
                      : "border-2 border-slate-900 rounded-lg"
                  }`}
                  style={{ minHeight: "160px", height: "auto" }}
                >
                  {/* Marcador de tesoura */}
                  {showCutGuides && (
                    <div className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1.5 text-[8px] text-slate-500 print:text-black flex items-center gap-1 z-10 pointer-events-none rounded">
                      <Scissors className="h-2.5 w-2.5" />
                      <span className="text-[7.5px] font-mono font-bold uppercase tracking-wider">corte</span>
                    </div>
                  )}

                  {/* Cabeçalho */}
                  <div className="w-full border-b border-slate-300 pb-1 mb-1.5 flex items-center justify-between px-1 pt-0.5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      CG CONSTRUÇÕES
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-600">
                      CGSTOCK
                    </span>
                  </div>

                  {/* Conteúdo Central com bastante espaço horizontal */}
                  <div className="flex items-center justify-center gap-3 w-full my-auto px-1">
                    <div className="p-1 bg-white rounded border border-slate-300 shrink-0">
                      <QRCodeSVG
                        value={qrValue}
                        size={70}
                        level="M"
                        includeMargin={false}
                      />
                    </div>

                    <div className="text-left flex-1 min-w-0 pr-1 flex flex-col justify-center">
                      {emp.employeeCode && (
                        <div className="inline-flex items-center font-mono text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded tracking-wide mb-1 self-start whitespace-nowrap">
                          MAT: {emp.employeeCode}
                        </div>
                      )}
                      <div className="font-bold text-xs sm:text-sm leading-snug text-slate-950 break-words line-clamp-2">
                        {emp.name}
                      </div>
                      {cpfFormatted && (
                        <div className="font-mono text-[10px] text-slate-900 mt-1 font-bold whitespace-nowrap tracking-tight">
                          <span className="font-sans text-[8px] font-semibold text-slate-500 mr-1 uppercase">CPF:</span>
                          {cpfFormatted}
                        </div>
                      )}
                      {emp.phone && (
                        <div className="font-mono text-[9px] text-slate-600 mt-0.5 whitespace-nowrap">
                          {formatPhone(emp.phone)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rodapé */}
                  <div className="w-full border-t border-slate-200 pt-1 mt-1.5 flex items-center justify-between text-[8.5px] font-mono text-slate-600 px-1">
                    <span className="truncate font-bold">{qrValue}</span>
                    <span className="uppercase font-bold text-slate-700 whitespace-nowrap">EPI / CAPACETE</span>
                  </div>
                </div>
              )
            }

            // GRADE 12 POR PÁGINA (3x4 - Compacto)
            if (gridPreset === "GRID_12") {
              return (
                <div
                  key={`${emp.id}-${copyIndex}-${idx}`}
                  className={`bg-white text-slate-950 p-2 sm:p-2.5 px-2.5 flex flex-col justify-between text-center relative break-inside-avoid print:break-inside-avoid ${
                    showCutGuides
                      ? "border border-dashed border-slate-400 print:border-slate-800 rounded-md"
                      : "border-2 border-slate-900 rounded-md"
                  }`}
                  style={{ minHeight: "145px" }}
                >
                  {/* Marcador de tesoura */}
                  {showCutGuides && (
                    <div className="absolute top-0 left-2 -translate-y-1/2 bg-white px-1 text-[7px] text-slate-500 print:text-black flex items-center gap-0.5 z-10 pointer-events-none rounded">
                      <Scissors className="h-2 w-2" />
                    </div>
                  )}

                  {/* Cabeçalho */}
                  <div className="w-full border-b border-slate-300 pb-0.5 mb-1 flex items-center justify-between px-1 pt-0.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-800">
                      CG CONSTRUÇÕES
                    </span>
                    <span className="text-[8px] font-mono font-bold text-slate-600">
                      CGSTOCK
                    </span>
                  </div>

                  {/* Conteúdo Central: Centralizado e com folga da borda direita */}
                  <div className="flex items-center justify-center gap-2 w-full my-auto px-1">
                    <div className="p-0.5 bg-white rounded border border-slate-300 shrink-0">
                      <QRCodeSVG
                        value={qrValue}
                        size={50}
                        level="M"
                        includeMargin={false}
                      />
                    </div>

                    <div className="text-left flex-1 min-w-0 pr-1 flex flex-col justify-center">
                      {emp.employeeCode && (
                        <div className="inline-flex items-center font-mono text-[8px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide mb-0.5 self-start whitespace-nowrap leading-none">
                          MAT: {emp.employeeCode}
                        </div>
                      )}
                      <div className="font-bold text-[9.5px] leading-[1.15] break-words line-clamp-3 text-slate-950">
                        {emp.name}
                      </div>
                      {cpfFormatted && (
                        <div className="font-mono text-[8px] text-slate-800 mt-0.5 font-bold whitespace-nowrap tracking-tighter leading-none flex items-center">
                          <span className="font-sans text-[6.5px] font-semibold text-slate-500 mr-0.5 uppercase">CPF:</span>
                          <span>{cpfFormatted}</span>
                        </div>
                      )}
                      {emp.phone && (
                        <div className="font-mono text-[7.5px] text-slate-500 mt-0.5 whitespace-nowrap leading-none">
                          {formatPhone(emp.phone)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rodapé */}
                  <div className="w-full border-t border-slate-200 pt-0.5 mt-1 flex items-center justify-between text-[7px] font-mono text-slate-500 px-1">
                    <span className="truncate">{qrValue}</span>
                    <span className="uppercase font-bold text-slate-700 whitespace-nowrap">CAPACETE</span>
                  </div>
                </div>
              )
            }

            // GRADE 6 POR PÁGINA (2x3 - Crachá Grande)
            if (gridPreset === "GRID_6") {
              return (
                <div
                  key={`${emp.id}-${copyIndex}-${idx}`}
                  className={`bg-white text-slate-950 p-4 flex flex-col items-center justify-between text-center relative break-inside-avoid print:break-inside-avoid ${
                    showCutGuides
                      ? "border-2 border-dashed border-slate-400 print:border-slate-800 rounded-xl"
                      : "border-2 border-slate-900 rounded-xl"
                  }`}
                  style={{ minHeight: "240px" }}
                >
                  {/* Furo para presilha/cordão */}
                  <div className="w-3.5 h-3.5 rounded-full border border-dashed border-slate-400 mx-auto -mt-1 mb-1 print:border-slate-800" />

                  <div className="w-full border-b border-slate-300 pb-1.5 mb-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-800">
                      CG CONSTRUÇÕES
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      CRACHÁ DE IDENTIFICAÇÃO & EPI
                    </div>
                  </div>

                  <div className="p-1.5 bg-white rounded-lg border border-slate-300 shadow-xs my-1">
                    <QRCodeSVG
                      value={qrValue}
                      size={90}
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  <div className="w-full my-1">
                    {emp.employeeCode && (
                      <div className="font-mono text-xs font-black bg-slate-900 text-white inline-block px-2.5 py-0.5 rounded tracking-wide mb-1 whitespace-nowrap">
                        MAT: {emp.employeeCode}
                      </div>
                    )}
                    <div className="font-bold text-sm leading-tight text-slate-950 break-words line-clamp-3">
                      {emp.name}
                    </div>
                    {cpfFormatted && (
                      <div className="text-[10.5px] font-mono text-slate-800 mt-1 font-bold whitespace-nowrap">
                        <span className="font-sans text-[9px] font-semibold text-slate-500 mr-1 uppercase">CPF:</span>
                        {cpfFormatted}
                      </div>
                    )}
                    {emp.phone && (
                      <div className="text-[9.5px] font-mono text-slate-600 mt-0.5 whitespace-nowrap">
                        {formatPhone(emp.phone)}
                      </div>
                    )}
                  </div>

                  <div className="w-full border-t border-slate-200 pt-1 text-[8px] font-mono text-slate-400 flex items-center justify-between">
                    <span>{qrValue}</span>
                    <span className="font-bold text-slate-600 uppercase whitespace-nowrap">USO PESSOAL</span>
                  </div>
                </div>
              )
            }

            // MODELO TÉRMICO (1 Coluna)
            return (
              <div
                key={`${emp.id}-${copyIndex}-${idx}`}
                className="bg-white text-slate-950 border-2 border-slate-900 rounded-lg p-2.5 flex flex-col justify-between text-center break-inside-avoid print:break-inside-avoid w-full max-w-[280px] mx-auto"
                style={{ minHeight: "140px" }}
              >
                <div className="w-full border-b border-slate-300 pb-1 mb-1 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider">CG CONSTRUÇÕES</span>
                  <span className="text-[8px] font-mono font-bold">CGSTOCK</span>
                </div>
                <div className="flex items-center gap-2.5 w-full justify-start my-auto">
                  <div className="p-1 bg-white rounded border border-slate-300 shrink-0">
                    <QRCodeSVG value={qrValue} size={64} level="M" includeMargin={false} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-mono text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded inline-block mb-1 whitespace-nowrap">
                      {emp.employeeCode ? `MAT: ${emp.employeeCode}` : "SEM MAT."}
                    </div>
                    <div className="font-bold text-xs leading-tight break-words line-clamp-3 text-slate-950">{emp.name}</div>
                    {cpfFormatted && (
                      <div className="font-mono text-[9px] text-slate-800 mt-0.5 font-bold whitespace-nowrap tracking-tight">
                        <span className="font-sans text-[7.5px] font-semibold text-slate-500 mr-1 uppercase">CPF:</span>
                        {cpfFormatted}
                      </div>
                    )}
                    {emp.phone && (
                      <div className="font-mono text-[8.5px] text-slate-600 mt-0.5 whitespace-nowrap">
                        {formatPhone(emp.phone)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full border-t border-slate-200 pt-1 mt-1 text-[8px] font-mono text-slate-600 flex items-center justify-between">
                  <span className="truncate">{qrValue}</span>
                  <span className="uppercase font-bold text-slate-700 whitespace-nowrap">EPI / CAPACETE</span>
                </div>
              </div>
            )
          })}
        </div>
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
