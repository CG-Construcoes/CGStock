"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  HardHat,
  Users,
  ShieldCheck,
  RefreshCw,
  Printer,
  ChevronRight,
  FileCheck,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { importEmployeesBatchAction, type EmployeeBatchItem } from "../actions"

type Worksite = {
  id: string
  name: string
  code: string
}

type ParsedEmployee = {
  name: string
  employeeCode: string | null
  document: string | null
  phone: string | null
  fantasia: string | null
}

const BATCH_SIZE = 500

export function EmployeeImportClient({ worksites }: { worksites: Worksite[] }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedEmployee[]>([])
  const [targetWorksiteId, setTargetWorksiteId] = useState<string>(worksites[0]?.id || "")
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  // Status de Importação em Lote
  const [isImporting, setIsImporting] = useState(false)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  const [insertedCount, setInsertedCount] = useState(0)
  const [updatedCount, setUpdatedCount] = useState(0)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [isFinished, setIsFinished] = useState(false)

  // Normalização de chaves da planilha para lowercase sem acentos
  const normalizeKey = (key: string) => {
    return key
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const processFile = (file: File) => {
    setParseError(null)
    setIsParsing(true)
    setSelectedFile(file)
    setIsFinished(false)
    setImportErrors([])
    setProcessedCount(0)
    setInsertedCount(0)
    setUpdatedCount(0)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" })

        if (!rawJson || rawJson.length === 0) {
          setParseError("A planilha selecionada está vazia.")
          setIsParsing(false)
          return
        }

        // Mapeamento inteligente de colunas
        const firstRow = rawJson[0]
        const rawKeys = Object.keys(firstRow)
        const keyMap: Record<string, string> = {}

        for (const k of rawKeys) {
          const norm = normalizeKey(k)
          if (norm.includes("codigo") || norm.includes("matricula") || norm === "cod") {
            keyMap.code = k
          } else if (norm.includes("razaosocial") || norm === "nome" || norm.includes("funcionario") || norm === "colaborador") {
            keyMap.name = k
          } else if (norm.includes("cpf") || norm.includes("cnpj") || norm.includes("documento")) {
            keyMap.document = k
          } else if (norm.includes("telefone") || norm.includes("celular") || norm === "fone" || norm === "tel") {
            keyMap.phone = k
          } else if (norm.includes("fantasia") || norm.includes("apelido")) {
            keyMap.fantasia = k
          }
        }

        if (!keyMap.name && !keyMap.code) {
          setParseError(
            "Não foi possível identificar as colunas de 'Nome' ou 'Código' na planilha. Verifique se o arquivo possui as colunas 'Código' e 'Razão Social'."
          )
          setIsParsing(false)
          return
        }

        const validEmployees: ParsedEmployee[] = []

        for (const row of rawJson) {
          const rawName = keyMap.name ? String(row[keyMap.name] || "").trim() : ""
          const rawCode = keyMap.code ? String(row[keyMap.code] || "").trim() : ""
          const rawDoc = keyMap.document ? String(row[keyMap.document] || "").trim() : ""
          const rawPhone = keyMap.phone ? String(row[keyMap.phone] || "").trim() : ""
          const rawFantasia = keyMap.fantasia ? String(row[keyMap.fantasia] || "").trim() : ""

          if (rawName || rawCode) {
            validEmployees.push({
              name: rawName || `Funcionário ${rawCode}`,
              employeeCode: rawCode || null,
              document: rawDoc || null,
              phone: rawPhone || null,
              fantasia: rawFantasia || null,
            })
          }
        }

        if (validEmployees.length === 0) {
          setParseError("Nenhuma linha válida de colaborador foi encontrada.")
          setIsParsing(false)
          return
        }

        setParsedRows(validEmployees)
        setIsParsing(false)
      } catch (err: any) {
        console.error("Erro ao ler arquivo:", err)
        setParseError(`Erro ao processar o arquivo: ${err.message}`)
        setIsParsing(false)
      }
    }

    reader.onerror = () => {
      setParseError("Falha ao abrir o arquivo no navegador.")
      setIsParsing(false)
    }

    reader.readAsArrayBuffer(file)
  }

  // Execução da Importação em Chunks Sequenciais
  const handleStartImport = async () => {
    if (parsedRows.length === 0 || isImporting) return

    setIsImporting(true)
    setIsFinished(false)
    setImportErrors([])

    const total = parsedRows.length
    const numBatches = Math.ceil(total / BATCH_SIZE)
    setTotalBatches(numBatches)
    setCurrentBatch(0)
    setProcessedCount(0)

    let totalInserted = 0
    let totalUpdated = 0
    const accumulatedErrors: string[] = []

    for (let i = 0; i < numBatches; i++) {
      setCurrentBatch(i + 1)
      const start = i * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, total)
      const batchSlice = parsedRows.slice(start, end)

      const batchItems: EmployeeBatchItem[] = batchSlice.map((emp) => ({
        name: emp.name,
        employeeCode: emp.employeeCode,
        document: emp.document,
        phone: emp.phone,
        fantasia: emp.fantasia,
      }))

      try {
        const result = await importEmployeesBatchAction(batchItems, targetWorksiteId || undefined)
        if (result.success) {
          totalInserted += result.inserted || 0
          totalUpdated += result.updated || 0
          if (result.errors && result.errors.length > 0) {
            accumulatedErrors.push(...result.errors)
          }
        } else {
          accumulatedErrors.push(`Lote ${i + 1}: ${result.message || "Erro desconhecido"}`)
        }
      } catch (err: any) {
        accumulatedErrors.push(`Lote ${i + 1}: ${err.message}`)
      }

      setProcessedCount(end)
      setInsertedCount(totalInserted)
      setUpdatedCount(totalUpdated)
      setImportErrors([...accumulatedErrors])
    }

    setIsImporting(false)
    setIsFinished(true)
    router.refresh()
  }

  const percent = parsedRows.length > 0 ? Math.round((processedCount / parsedRows.length) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/employees"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Funcionários
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Importar Planilha de Funcionários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Carregue sua planilha (.xlsx, .xls ou .csv) contendo a equipe de campo para bipe de capacete.
          </p>
        </div>
      </div>

      {/* Regra de Negócio: Diferença entre Usuários e Funcionários */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-sm space-y-2">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold">
          <HardHat className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>Garantia de Isolamento: Funcionários de Campo ≠ Usuários do Sistema</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Os colaboradores importados nesta tela serão cadastrados <strong>exclusivamente como funcionários operacionais</strong> com <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">loginEnabled: false</code>.
          Eles <strong>não</strong> receberão senha, não precisam de e-mail e não terão acesso de login à plataforma web, evitando poluir a lista de usuários administradores do sistema.
          Cada um terá seu QR Code gerado para uso no capacete e entregas rápidas.
        </p>
      </div>

      {/* File Dropzone */}
      {!isFinished && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <UploadCloud className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Clique para selecionar ou arraste o arquivo aqui
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Suporta arquivos <strong>.xlsx</strong> (ex: <code className="text-primary">lista de funcionários (1).xlsx</code>), <strong>.xls</strong> e <strong>.csv</strong>
                </p>
              </div>
            </div>
          </div>

          {parseError && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro ao processar arquivo</p>
                <p className="text-xs mt-0.5">{parseError}</p>
              </div>
            </div>
          )}

          {/* Preview dos dados detectados */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-border animate-in fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <FileCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-foreground">
                      {parsedRows.length.toLocaleString("pt-BR")} colaboradores identificados
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Arquivo: <strong>{selectedFile?.name}</strong> (
                      {selectedFile ? (selectedFile.size / 1024).toFixed(0) : 0} KB)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="text-xs text-muted-foreground">Vincular à obra:</div>
                  <select
                    value={targetWorksiteId}
                    onChange={(e) => setTargetWorksiteId(e.target.value)}
                    disabled={isImporting}
                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-xs focus:ring-1 focus:ring-primary"
                  >
                    {worksites.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabela de Amostra das primeiras 5 linhas */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="p-2.5 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Prévia das primeiras 5 linhas</span>
                  <span className="font-mono text-[11px] font-normal">
                    Loteamento em blocos de {BATCH_SIZE} para performance máxima
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/20 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-3 py-2">Matrícula / Código</th>
                        <th className="px-3 py-2">Razão Social / Nome</th>
                        <th className="px-3 py-2">CPF / Documento</th>
                        <th className="px-3 py-2">Telefone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono font-bold text-foreground">
                            {row.employeeCode || "—"}
                          </td>
                          <td className="px-3 py-2 font-semibold text-foreground">
                            {row.name}
                          </td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">
                            {row.document || "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.phone || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Barra de Progresso durante a Importação */}
              {isImporting && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      Importando lote {currentBatch} de {totalBatches}...
                    </span>
                    <span className="font-mono font-bold text-primary">{percent}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border">
                    <div
                      className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {processedCount.toLocaleString("pt-BR")} de{" "}
                      {parsedRows.length.toLocaleString("pt-BR")} processados
                    </span>
                    <span>
                      {insertedCount} inseridos • {updatedCount} atualizados
                    </span>
                  </div>
                </div>
              )}

              {/* Botão de Ação */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  disabled={isImporting}
                  onClick={() => {
                    setSelectedFile(null)
                    setParsedRows([])
                  }}
                >
                  Limpar
                </Button>
                <Button
                  onClick={handleStartImport}
                  disabled={isImporting}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold active:scale-95 transition-all shadow-sm"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importando ({processedCount}/{parsedRows.length})...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar e Importar {parsedRows.length.toLocaleString("pt-BR")} Funcionários
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TELA DE SUCESSO APÓS IMPORTAÇÃO */}
      {isFinished && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-6 shadow-md animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Importação Concluída com Sucesso!
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Todos os colaboradores da planilha foram processados e seus códigos de entrega rápida
              foram gerados.
            </p>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div className="p-3 rounded-lg border border-border bg-background">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {insertedCount.toLocaleString("pt-BR")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Novos Inseridos</div>
            </div>
            <div className="p-3 rounded-lg border border-border bg-background">
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {updatedCount.toLocaleString("pt-BR")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Atualizados</div>
            </div>
            <div className="p-3 rounded-lg border border-border bg-background">
              <div className="text-2xl font-black text-foreground">
                {processedCount.toLocaleString("pt-BR")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Total Processado</div>
            </div>
          </div>

          {importErrors.length > 0 && (
            <div className="max-w-md mx-auto p-3 rounded-lg bg-destructive/10 text-destructive text-xs text-left max-h-32 overflow-y-auto">
              <div className="font-semibold mb-1">Avisos ({importErrors.length}):</div>
              {importErrors.slice(0, 10).map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
              {importErrors.length > 10 && (
                <div>... e mais {importErrors.length - 10} avisos.</div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/admin/employees">
              <Button variant="outline" className="gap-2">
                <Users className="h-4 w-4" />
                Ver Lista de Funcionários
              </Button>
            </Link>

            <Link href="/admin/employees/print-badges">
              <Button className="gap-2 bg-primary text-primary-foreground">
                <Printer className="h-4 w-4" />
                Imprimir Etiquetas de Capacete
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
