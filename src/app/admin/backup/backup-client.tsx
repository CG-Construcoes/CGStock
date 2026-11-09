"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Download, Upload, Loader2, CheckCircle2, XCircle } from "lucide-react"

/** Rótulos amigáveis das tabelas para o acompanhamento da restauração. */
const TABLE_LABELS: Record<string, string> = {
  AuditLog: "Auditoria",
  ImportBatch: "Lotes de importação",
  ImportBatchRow: "Linhas de importação",
  InfMirror: "Espelho do ERP",
  Inventory: "Inventários",
  InventoryCollection: "Coletas de inventário",
  InventoryCollectionItem: "Itens coletados",
  InventoryDivergence: "Divergências de inventário",
  InventoryLocation: "Locais de inventário",
  InventoryOperator: "Operadores de inventário",
  LoginAttempt: "Tentativas de login",
  MaterialRequest: "Requisições",
  MaterialRequestItem: "Itens de requisição",
  MaterialReturn: "Devoluções",
  MaterialReturnItem: "Itens de devolução",
  Notification: "Notificações",
  OfflineSyncOperation: "Operações offline",
  Permission: "Permissões",
  Product: "Produtos",
  ProductCategory: "Categorias de produto",
  ProductUnit: "Unidades de medida",
  QuickIssue: "Saídas rápidas",
  QuickIssueItem: "Itens de saída rápida",
  Role: "Papéis",
  RolePermission: "Permissões por papel",
  Stock: "Estoque",
  StockMovement: "Movimentações de estoque",
  StockReceipt: "Recebimentos",
  StockReceiptItem: "Itens de recebimento",
  StockTransfer: "Transferências",
  StockTransferItem: "Itens de transferência",
  Supplier: "Fornecedores",
  SyncCheckpoint: "Checkpoints de sincronização",
  SyncRun: "Execuções de sincronização",
  SystemSetting: "Configurações do sistema",
  Tenant: "Empresas",
  ToolAsset: "Ferramentas",
  ToolLoan: "Empréstimos de ferramentas",
  ToolLoanItem: "Itens de empréstimo",
  User: "Usuários e funcionários",
  UserWarehouseAccess: "Acessos a almoxarifados",
  UserWorksiteAccess: "Acessos a obras",
  Warehouse: "Almoxarifados",
  WarehouseLocation: "Localizações",
  Worksite: "Obras",
  _RoleToUser: "Vínculos de papéis",
}

interface RestoreProgress {
  phase: "wiping" | "table"
  table?: string
  done: number
  total: number
  rows: number
  startedAt: number
  elapsedMs: number
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 1) return "quase lá"
  if (seconds < 60) return `~${Math.ceil(seconds)}s`
  return `~${Math.floor(seconds / 60)}min${Math.ceil(seconds % 60)}s`
}

export function BackupClient() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const [exporting, setExporting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<RestoreProgress | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const canRestore = !!file && confirmText === "RESTAURAR" && !busy

  const doExport = async () => {
    setExporting(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/backup/export")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Falha ao gerar o backup.")
      }
      const blob = await res.blob()
      const cd = res.headers.get("Content-Disposition") ?? ""
      const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? "cgstock-backup.json.gz"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Erro ao baixar o backup." })
    } finally {
      setExporting(false)
    }
  }

  const doRestore = async () => {
    if (!file || !canRestore) return
    setBusy(true)
    setResult(null)
    setProgress({ phase: "wiping", done: 0, total: 0, rows: 0, startedAt: Date.now(), elapsedMs: 0 })
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/backup/import", { method: "POST", body: fd })

      if (!res.ok || !res.body || !res.headers.get("content-type")?.includes("ndjson")) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Falha ao restaurar o backup.")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      let finished = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx: number
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx)
          buf = buf.slice(idx + 1)
          if (!line.trim()) continue
          const msg = JSON.parse(line)
          if (msg.type === "progress") {
            setProgress((prev) => {
              const startedAt = prev?.startedAt ?? Date.now()
              return {
                phase: msg.phase,
                table: msg.table,
                done: msg.done,
                total: msg.total,
                rows: msg.rows,
                startedAt,
                elapsedMs: Date.now() - startedAt,
              }
            })
          } else if (msg.type === "done") {
            finished = true
            setResult({
              ok: true,
              message: `Backup restaurado: ${msg.totalRows?.toLocaleString("pt-BR")} registros em ${msg.tables} tabelas.`,
            })
          } else if (msg.type === "error") {
            throw new Error(msg.error || "Falha ao restaurar o backup.")
          }
        }
      }
      if (finished) {
        setFile(null)
        setConfirmText("")
        if (fileRef.current) fileRef.current.value = ""
      } else if (!result) {
        throw new Error("A conexão foi interrompida durante a restauração.")
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Erro de conexão ao enviar o backup." })
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const eta =
    progress && progress.done > 0
      ? (progress.elapsedMs / progress.done) * (progress.total - progress.done) / 1000
      : null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            Baixar backup
          </CardTitle>
          <CardDescription>
            Gera um arquivo <code className="text-xs">.json.gz</code> com todas as tabelas do sistema (produtos,
            estoque, movimentações, usuários, funcionários, ferramentaria, pedidos, configurações).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={doExport} disabled={exporting} className="w-full sm:w-auto">
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {exporting ? "Gerando backup..." : "Baixar backup completo"}
          </Button>
          {exporting && (
            <p className="text-sm text-muted-foreground mt-2">
              Preparando o arquivo no servidor — leva cerca de 10 segundos.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-red-600 dark:text-red-500" />
            Restaurar backup
          </CardTitle>
          <CardDescription>
            Substitui <strong>TODO</strong> o conteúdo atual do banco pelo arquivo selecionado. Esta ação é
            irreversível — baixe um backup atual antes de restaurar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            ref={fileRef}
            type="file"
            accept=".gz,.json,application/gzip,application/json"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setResult(null)
            }}
          />
          {file && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Arquivo: <strong>{file.name}</strong> ({(file.size / 1048576).toFixed(2)} MB)
              </p>
              <label className="text-sm font-medium text-foreground block">
                Digite <code className="text-red-600 dark:text-red-400 font-bold">RESTAURAR</code> para confirmar a
                substituição de todos os dados:
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESTAURAR"
                autoComplete="off"
              />
            </div>
          )}
          <Button variant="destructive" disabled={!canRestore} onClick={doRestore} className="w-full sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {busy ? "Restaurando..." : "Restaurar sistema"}
          </Button>

          {busy && progress && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {progress.phase === "wiping"
                    ? "Limpando dados atuais..."
                    : `Restaurando ${TABLE_LABELS[progress.table ?? ""] ?? progress.table}`}
                </span>
                <span className="text-muted-foreground tabular-nums">{progress.total > 0 ? `${pct}%` : "…"}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-amber-600 transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? pct : 15}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progress.total > 0
                  ? `Etapa ${progress.done} de ${progress.total} · ${progress.rows.toLocaleString("pt-BR")} registros restaurados${eta ? ` · ${formatEta(eta)} restantes` : ""}`
                  : "Enviando arquivo e preparando restauração..."}
              </p>
            </div>
          )}

          {result && (
            <div
              className={`flex items-start gap-2 text-sm rounded-md border p-3 ${
                result.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
              }`}
            >
              {result.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <XCircle className="h-4 w-4 mt-0.5" />}
              <span>{result.message}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
