"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Download, Filter, Loader2 } from "lucide-react"
import { exportToExcel, exportToPDF } from "@/lib/export-utils"
import { exportMovementsData } from "@/app/export/actions"
import { toast } from "sonner"

export function ReportsHeaderControls({ initialFrom, initialTo, warehouseId }: { initialFrom: string, initialTo: string, warehouseId?: string }) {
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    try {
      if (format === 'xlsx') setLoadingExcel(true)
      else setLoadingPdf(true)

      const fromDate = new Date(initialFrom + "T00:00:00")
      const toDate = new Date(initialTo + "T23:59:59")
      
      const data = await exportMovementsData(fromDate, toDate, warehouseId || "ALL")

      if (!data || data.length === 0) {
        throw new Error("Não há dados no período selecionado.")
      }

      const title = "RELATÓRIO DE MOVIMENTAÇÕES"
      const periodStr = `${initialFrom.split('-').reverse().join('/')} até ${initialTo.split('-').reverse().join('/')}`
      const filename = `CGSTOCK_Movimentacoes_${initialFrom}_a_${initialTo}`

      if (format === 'xlsx') {
        exportToExcel(data, filename)
      } else {
        exportToPDF(data, title, filename, periodStr)
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
    <div className="flex items-center gap-3 mt-8">
      <button 
        onClick={() => handleExport('pdf')}
        disabled={loadingPdf}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-border rounded-md text-foreground hover:bg-muted transition-colors shadow-sm disabled:opacity-50"
      >
        {loadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Exportar PDF
      </button>
      <button 
        onClick={() => handleExport('xlsx')}
        disabled={loadingExcel}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
      >
        {loadingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Exportar Excel
      </button>
    </div>
  )
}

export function ReportsFilterControls({ initialFrom, initialTo }: { initialFrom: string, initialTo: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (from) params.set('from', from)
    else params.delete('from')
    
    if (to) params.set('to', to)
    else params.delete('to')

    router.push(`/reports?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 bg-card border border-border p-3 rounded-md shadow-sm">
      <Filter className="h-4 w-4 text-muted-foreground ml-1" />
      <span className="text-sm font-medium text-foreground mr-2">Período</span>
      <input 
        type="date" 
        value={from}
        onChange={e => setFrom(e.target.value)}
        className="text-xs border border-border rounded-sm px-2 py-1.5 bg-input text-foreground outline-none focus:border-ring" 
      />
      <span className="text-muted-foreground text-xs font-medium px-1">até</span>
      <input 
        type="date" 
        value={to}
        onChange={e => setTo(e.target.value)}
        className="text-xs border border-border rounded-sm px-2 py-1.5 bg-input text-foreground outline-none focus:border-ring" 
      />
      <button 
        onClick={applyFilters}
        className="ml-2 px-4 py-1.5 text-xs font-bold bg-muted text-foreground border border-border rounded-sm hover:bg-muted-foreground/10 transition-colors"
      >
        Aplicar filtros
      </button>
    </div>
  )
}
