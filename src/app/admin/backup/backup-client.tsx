"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Download, Upload, Loader2, CheckCircle2, XCircle } from "lucide-react"

export function BackupClient() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const canRestore = !!file && confirmText === "RESTAURAR" && !busy

  const doRestore = async () => {
    if (!file || !canRestore) return
    setBusy(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/backup/import", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setResult({
          ok: true,
          message: `Backup restaurado: ${data.totalRows?.toLocaleString("pt-BR")} registros em ${Object.keys(data.summary ?? {}).length} tabelas.`,
        })
        setFile(null)
        setConfirmText("")
        if (fileRef.current) fileRef.current.value = ""
      } else {
        setResult({ ok: false, message: data.error || "Falha ao restaurar o backup." })
      }
    } catch {
      setResult({ ok: false, message: "Erro de conexão ao enviar o backup." })
    } finally {
      setBusy(false)
    }
  }

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
          <Button asChild className="w-full sm:w-auto">
            <a href="/api/admin/backup/export" download>
              <Download className="h-4 w-4 mr-2" />
              Baixar backup completo
            </a>
          </Button>
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
