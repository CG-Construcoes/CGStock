"use client"

import { useState } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import {
  Printer,
  ArrowLeft,
  HardHat,
  Columns,
  Sparkles,
  CheckCircle2,
  Sliders
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
  worksiteAccesses: {
    worksite: { name: string; code: string }
  }[]
}

export function PrintBadgesClient({
  employees,
  isFiltered,
  totalActive,
}: {
  employees: PrintEmployee[]
  isFiltered: boolean
  totalActive: number
}) {
  const [layoutMode, setLayoutMode] = useState<"HELMET" | "BADGE">("HELMET")
  const [columns, setColumns] = useState<number>(3)

  const handlePrint = () => {
    window.print()
  }

  const formatCpf = (cpf?: string | null) => {
    if (!cpf) return ""
    const clean = cpf.replace(/\D/g, "")
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`
    }
    return cpf
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-foreground print:bg-white print:text-black">
      {/* Barra de Controles Superior - Oculta na Impressão */}
      <header className="print:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border p-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                Impressão de Etiquetas de Capacete
              </h1>
              <p className="text-xs text-muted-foreground">
                {employees.length} etiqueta(s) gerada(s){" "}
                {isFiltered ? "(seleção personalizada)" : `(de ${totalActive} colaboradores ativos)`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Modelo */}
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs">
              <button
                onClick={() => setLayoutMode("HELMET")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  layoutMode === "HELMET"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Adesivo de Capacete (50x35mm)
              </button>
              <button
                onClick={() => setLayoutMode("BADGE")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  layoutMode === "BADGE"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Crachá (85x54mm)
              </button>
            </div>

            {/* Seletor de Colunas para Folha A4 */}
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs">
              <span className="px-2 text-muted-foreground">Colunas:</span>
              <button
                onClick={() => setColumns(2)}
                className={`px-2 py-1 rounded-md font-medium ${
                  columns === 2 ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                2
              </button>
              <button
                onClick={() => setColumns(3)}
                className={`px-2 py-1 rounded-md font-medium ${
                  columns === 3 ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                3
              </button>
              <button
                onClick={() => setColumns(4)}
                className={`px-2 py-1 rounded-md font-medium ${
                  columns === 4 ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                4
              </button>
            </div>

            <Button
              onClick={handlePrint}
              className="gap-2 bg-primary text-primary-foreground font-semibold shadow-sm active:scale-95"
            >
              <Printer className="h-4 w-4" />
              Imprimir Agora
            </Button>
          </div>
        </div>
      </header>

      {/* Dica de Impressão na Tela */}
      <div className="print:hidden max-w-6xl mx-auto px-4 pt-4">
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
          <span>
            💡 <strong>Dica de Impressão:</strong> Nas configurações da impressora, defina as <strong>Margens como "Mínimas"</strong> ou "Nenhuma" e marque <strong>"Gráficos de segundo plano"</strong> para máxima definição do adesivo.
          </span>
          <span className="font-mono text-[11px] shrink-0 ml-2">Papel A4 / Etiquetas Adesivas</span>
        </div>
      </div>

      {/* Área Imprimível */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8 print:p-0 print:max-w-none">
        <div
          className={`grid gap-3 sm:gap-4 print:gap-2 justify-center ${
            columns === 2
              ? "grid-cols-1 sm:grid-cols-2 print:grid-cols-2"
              : columns === 4
              ? "grid-cols-2 sm:grid-cols-4 print:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-3 print:grid-cols-3"
          }`}
        >
          {employees.map((emp) => {
            const qrValue = emp.qrToken || (emp.employeeCode ? `EMP-${emp.employeeCode}` : emp.id)
            const cpfFormatted = formatCpf(emp.document)

            if (layoutMode === "HELMET") {
              return (
                <div
                  key={emp.id}
                  className="bg-white text-slate-950 border-2 border-slate-900 rounded-lg p-2.5 shadow-sm print:shadow-none flex flex-col items-center justify-between text-center break-inside-avoid print:break-inside-avoid w-full max-w-xs mx-auto"
                  style={{ minHeight: "150px" }}
                >
                  {/* Cabeçalho */}
                  <div className="w-full border-b border-slate-300 pb-1 mb-1.5 flex items-center justify-between px-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">
                      CG CONSTRUÇÕES
                    </span>
                    <span className="text-[8px] font-mono font-bold text-slate-500">
                      CGSTOCK
                    </span>
                  </div>

                  {/* Conteúdo Central: QR Code + Detalhes */}
                  <div className="flex items-center gap-2.5 w-full justify-center">
                    <div className="p-1 bg-white rounded border border-slate-300 shrink-0">
                      <QRCodeSVG
                        value={qrValue}
                        size={72}
                        level="H"
                        includeMargin={false}
                      />
                    </div>

                    <div className="text-left flex-1 min-w-0">
                      {emp.employeeCode && (
                        <div className="inline-block font-mono text-[11px] font-extrabold bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded border border-slate-300 mb-0.5">
                          MAT: {emp.employeeCode}
                        </div>
                      )}
                      <div className="font-bold text-xs leading-tight line-clamp-2 text-slate-900">
                        {emp.name}
                      </div>
                      {cpfFormatted && (
                        <div className="font-mono text-[9px] text-slate-600 mt-0.5">
                          CPF: {cpfFormatted}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rodapé com Código do Token para Bipe Manual */}
                  <div className="w-full border-t border-slate-200 pt-1 mt-1 flex items-center justify-between text-[8px] font-mono text-slate-500 px-1">
                    <span className="truncate">{qrValue}</span>
                    <span className="text-[7px] uppercase font-bold text-slate-600">EPI / CAPACETE</span>
                  </div>
                </div>
              )
            }

            // Modelo Crachá (Médio)
            return (
              <div
                key={emp.id}
                className="bg-white text-slate-950 border-2 border-slate-800 rounded-xl p-4 shadow-sm print:shadow-none flex flex-col items-center justify-between text-center break-inside-avoid print:break-inside-avoid w-full max-w-xs mx-auto"
                style={{ minHeight: "240px" }}
              >
                <div className="w-full border-b border-slate-300 pb-2 mb-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                    CG CONSTRUÇÕES
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    CRACHÁ DE IDENTIFICAÇÃO & EPI
                  </div>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs my-1">
                  <QRCodeSVG
                    value={qrValue}
                    size={110}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <div className="w-full my-1">
                  {emp.employeeCode && (
                    <div className="font-mono text-xs font-extrabold bg-slate-100 text-slate-900 inline-block px-2 py-0.5 rounded border border-slate-300 mb-1">
                      MATRÍCULA: {emp.employeeCode}
                    </div>
                  )}
                  <div className="font-bold text-sm leading-tight text-slate-950 line-clamp-2">
                    {emp.name}
                  </div>
                  {cpfFormatted && (
                    <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                      CPF: {cpfFormatted}
                    </div>
                  )}
                </div>

                <div className="w-full border-t border-slate-200 pt-1 text-[9px] font-mono text-slate-400">
                  {qrValue}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Regras CSS Específicas de Impressão */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            margin: 0.8cm;
            size: A4 portrait;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />
    </div>
  )
}
