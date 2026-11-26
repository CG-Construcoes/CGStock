"use client"

import { useState } from "react"
import { FileSpreadsheet, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { exportInformakonXls } from "@/lib/export-utils"
import { ENTRADAS_HEADERS, SAIDAS_HEADERS, type InformakonKind } from "@/lib/informakon-export"
import { exportInformakonData } from "./actions"

function isoDay(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export function InformakonExportCard({ warehouseId }: { warehouseId: string }) {
  const [from, setFrom] = useState(() => isoDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo] = useState(() => isoDay(new Date()))
  const [loading, setLoading] = useState<InformakonKind | null>(null)
  const [issues, setIssues] = useState<string[]>([])

  const handleExport = async (kind: InformakonKind) => {
    if (from > to) return toast.error("A data inicial deve ser anterior à data final.")
    setLoading(kind)
    try {
      const result = await exportInformakonData(from, to, warehouseId || "ALL")
      setIssues(result.issues)
      const rows = result[kind]
      if (!rows.length) {
        toast.error(result.issues.length ? "Nenhuma linha válida — corrija os cadastros indicados abaixo." : "Não há movimentações no período.")
        return
      }
      const period = `${from.split("-").reverse().join("")}_${to.split("-").reverse().join("")}`
      if (kind === "entradas") await exportInformakonXls(rows, ENTRADAS_HEADERS, "Entradas", `Informakon_Entradas_${period}`)
      else await exportInformakonXls(rows, SAIDAS_HEADERS, "Saidas", `Informakon_Saidas_${period}`)
      toast.success(`${rows.length} linha(s) exportada(s).${result.issues.length ? " Algumas movimentações ficaram de fora — veja os avisos." : ""}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar a planilha.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card className="shadow-sm border-border md:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg">Importação no Informakon</CardTitle>
        <CardDescription>
          Planilhas .xls no modelo de importação do Informakon (Konstroi): uma para Entradas e outra para Saídas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <label className="space-y-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            De
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Até
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground" />
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => handleExport("entradas")} disabled={!!loading} className="flex-1">
            {loading === "entradas" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Planilha de Entradas (.xls)
          </Button>
          <Button onClick={() => handleExport("saidas")} disabled={!!loading} className="flex-1">
            {loading === "saidas" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Planilha de Saídas (.xls)
          </Button>
        </div>

        {issues.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Movimentações não exportadas:</p>
            <ul className="list-disc pl-5 text-xs space-y-0.5">
              {issues.slice(0, 10).map(issue => <li key={issue}>{issue}</li>)}
              {issues.length > 10 && <li>…e mais {issues.length - 10}.</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
