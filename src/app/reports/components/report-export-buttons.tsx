"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { exportToExcel, exportToPDF } from "@/lib/export-utils"
import { toast } from "sonner"

type LoadData = () => Promise<Record<string, unknown>[]>

/**
 * Botões "Exportar PDF / Excel" dos sub-relatórios.
 * `loadData` é uma server action (bind com os filtros da página) que devolve as linhas.
 */
export function ReportExportButtons({ title, filename, period, loadData }: {
  title: string
  filename: string
  period?: string
  loadData: LoadData
}) {
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    try {
      if (format === 'xlsx') setLoadingExcel(true)
      else setLoadingPdf(true)

      const data = await loadData()
      if (!data || data.length === 0) {
        throw new Error("Não há dados para exportar.")
      }

      if (format === 'xlsx') {
        await exportToExcel(data, filename)
      } else {
        await exportToPDF(data, title, filename, period)
      }

      toast.success("Download concluído com sucesso.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao exportar.")
    } finally {
      setLoadingExcel(false)
      setLoadingPdf(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleExport('pdf')}
        disabled={loadingPdf || loadingExcel}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-border rounded-md text-foreground hover:bg-muted transition-colors shadow-sm disabled:opacity-50"
      >
        {loadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        PDF
      </button>
      <button
        onClick={() => handleExport('xlsx')}
        disabled={loadingExcel || loadingPdf}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
      >
        {loadingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Excel
      </button>
    </div>
  )
}
