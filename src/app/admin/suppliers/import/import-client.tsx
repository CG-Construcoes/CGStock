"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import * as XLSX from "xlsx"
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Truck,
  Building2,
  RefreshCw,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  detectSupplierSourceFromFilename,
  mapSupplierRow,
  type SupplierBatchItem,
  type SupplierSource,
} from "@/lib/supplier-import"
import { importSuppliersBatchAction } from "../actions"

const BATCH_SIZE = 500

export function SupplierImportClient() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<SupplierBatchItem[]>([])
  const [source, setSource] = useState<SupplierSource | "">("")
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const [isImporting, setIsImporting] = useState(false)
  const [processedCount, setProcessedCount] = useState(0)
  const [createdCount, setCreatedCount] = useState(0)
  const [updatedCount, setUpdatedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [importError, setImportError] = useState<string | null>(null)
  const [isFinished, setIsFinished] = useState(false)

  const categoryCount = new Map<string, number>()
  for (const r of parsedRows) {
    const cat = r.category || "Sem categoria"
    categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1)
  }
  const topCategories = [...categoryCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const reset = () => {
    setSelectedFile(null)
    setParsedRows([])
    setSource("")
    setParseError(null)
    setProcessedCount(0)
    setCreatedCount(0)
    setUpdatedCount(0)
    setSkippedCount(0)
    setImportError(null)
    setIsFinished(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const processFile = async (file: File) => {
    setIsParsing(true)
    setParseError(null)
    setParsedRows([])
    setSelectedFile(file)
    setSource(detectSupplierSourceFromFilename(file.name) ?? "")

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })

      const mapped = rawRows
        .map((r) => mapSupplierRow(r))
        .filter((r): r is SupplierBatchItem => r !== null)

      if (mapped.length === 0) {
        setParseError("Nenhum fornecedor encontrado. Verifique se a planilha tem as colunas Código e Razão Social.")
      } else {
        setParsedRows(mapped)
      }
    } catch {
      setParseError("Não foi possível ler o arquivo. Envie uma planilha .xlsx válida do Informakon.")
    } finally {
      setIsParsing(false)
    }
  }

  const handleImport = async () => {
    if (!source || parsedRows.length === 0) return
    setIsImporting(true)
    setImportError(null)
    setProcessedCount(0)
    setCreatedCount(0)
    setUpdatedCount(0)
    setSkippedCount(0)

    try {
      for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
        const batch = parsedRows.slice(i, i + BATCH_SIZE)
        const res = await importSuppliersBatchAction(batch, source)
        if ("error" in res && res.error) {
          setImportError(res.error)
          return
        }
        setCreatedCount((c) => c + (res.created ?? 0))
        setUpdatedCount((u) => u + (res.updated ?? 0))
        setSkippedCount((s) => s + (res.skipped ?? 0))
        setProcessedCount((p) => p + batch.length)
      }
      setIsFinished(true)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Erro inesperado durante a importação.")
    } finally {
      setIsImporting(false)
    }
  }

  const progress = parsedRows.length > 0 ? Math.round((processedCount / parsedRows.length) * 100) : 0

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 sm:pb-8">
      <div className="flex items-center gap-4">
        <Link href="/admin/suppliers">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Importar Fornecedores</h2>
          <p className="text-sm text-muted-foreground">
            Planilha &quot;CADASTRO FORNECEDOR&quot; exportada do Informakon (MGA ou CV).
          </p>
        </div>
      </div>

      {/* Upload */}
      <div
        className="border-2 border-dashed border-border rounded-xl p-6 sm:p-10 text-center bg-card hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => !isParsing && !isImporting && fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files?.[0]
          if (file) void processFile(file)
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void processFile(file)
          }}
        />
        <UploadCloud className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        {selectedFile ? (
          <div className="flex items-center justify-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <span className="font-medium text-sm">{selectedFile.name}</span>
            <button
              type="button"
              className="ml-2 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                reset()
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <p className="font-medium">Arraste a planilha aqui ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">Arquivos .xlsx do Informakon</p>
          </>
        )}
        {isParsing && <p className="text-sm text-muted-foreground mt-3">Lendo planilha...</p>}
        {parseError && (
          <p className="text-sm text-destructive mt-3 flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {parseError}
          </p>
        )}
      </div>

      {/* Empresa de origem */}
      {parsedRows.length > 0 && !isFinished && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Esses fornecedores pertencem a qual empresa? *
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as SupplierSource | "")}
              disabled={isImporting}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione a empresa...</option>
              <option value="MGA">MGA — CG Construções</option>
              <option value="CV">CV — Conceito</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Fornecedores da MGA só aparecem em almoxarifados MGA; os da CV, só em almoxarifados CV.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-2xl font-bold">{parsedRows.length.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">linhas válidas</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-2xl font-bold">{categoryCount.size}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">categorias</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-2xl font-bold">{parsedRows.filter((r) => r.status === "INACTIVE").length.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">inativos</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-2xl font-bold">{parsedRows.filter((r) => !r.document).length.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">sem CNPJ/CPF</p>
            </div>
          </div>

          {topCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topCategories.map(([cat, count]) => (
                <Badge key={cat} variant="secondary" className="text-[11px]">
                  {cat} ({count.toLocaleString("pt-BR")})
                </Badge>
              ))}
            </div>
          )}

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Código</th>
                    <th className="text-left px-3 py-2 font-medium">Razão Social</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Categoria</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">CNPJ/CPF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {parsedRows.slice(0, 10).map((r) => (
                    <tr key={r.erpCode}>
                      <td className="px-3 py-2 font-mono">{r.erpCode}</td>
                      <td className="px-3 py-2 truncate max-w-[200px]">{r.name}</td>
                      <td className="px-3 py-2 hidden sm:table-cell">{r.category || "-"}</td>
                      <td className="px-3 py-2 hidden sm:table-cell font-mono">{r.document || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground px-3 py-2 border-t border-border/50 bg-muted/30">
              Mostrando 10 de {parsedRows.length.toLocaleString("pt-BR")} linhas
            </p>
          </div>

          {isImporting ? (
            <div className="space-y-2">
              <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Importando... {processedCount.toLocaleString("pt-BR")} de {parsedRows.length.toLocaleString("pt-BR")} ({progress}%)
              </p>
            </div>
          ) : (
            <Button
              className="w-full h-12 text-base"
              disabled={!source || parsedRows.length === 0}
              onClick={handleImport}
            >
              <Truck className="h-5 w-5 mr-2" />
              Importar {parsedRows.length.toLocaleString("pt-BR")} fornecedores {source ? `(${source})` : ""}
            </Button>
          )}

          {importError && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {importError}
            </p>
          )}
        </div>
      )}

      {/* Resultado */}
      {isFinished && (
        <div className="bg-card border border-emerald-500/30 rounded-xl p-6 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
          <div>
            <h3 className="text-lg font-bold">Importação concluída ({source})</h3>
            <p className="text-sm text-muted-foreground">
              {createdCount.toLocaleString("pt-BR")} criados, {updatedCount.toLocaleString("pt-BR")} atualizados
              {skippedCount > 0 && `, ${skippedCount.toLocaleString("pt-BR")} ignorados`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/admin/suppliers">
              <Button className="w-full sm:w-auto">
                <Truck className="h-4 w-4 mr-2" /> Ver fornecedores
              </Button>
            </Link>
            <Button variant="outline" onClick={reset} className="w-full sm:w-auto">
              <RefreshCw className="h-4 w-4 mr-2" /> Importar outro arquivo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
