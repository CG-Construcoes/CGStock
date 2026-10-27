"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

type SyncStatus = {
  enabled: boolean
  running: boolean
  lastRun?: {
    startedAt?: string
    finishedAt?: string
    ok?: boolean
  }
}

function fmtTime(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  })
}

export function InformakonSyncCard() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/informakon/sync", { cache: "no-store" })
      if (!res.ok) throw new Error()
      setStatus(await res.json())
      setOffline(false)
    } catch {
      setOffline(true)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // Enquanto houver ciclo rodando, reconsulta o status a cada 5s
  useEffect(() => {
    if (!status?.running) return
    const t = setInterval(() => void refresh(), 5000)
    return () => clearInterval(t)
  }, [status?.running, refresh])

  async function runSync() {
    setLoading(true)
    setFeedback(null)
    try {
      const res = await fetch("/api/informakon/sync", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) {
        setFeedback({ ok: false, msg: data.error ?? "Falha ao iniciar sincronização." })
      } else {
        setFeedback({ ok: true, msg: "Sincronização iniciada." })
        await refresh()
      }
    } catch {
      setFeedback({ ok: false, msg: "Serviço de sincronização indisponível." })
    } finally {
      setLoading(false)
    }
  }

  const running = loading || status?.running
  const lastFinished = fmtTime(status?.lastRun?.finishedAt)

  return (
    <Card>
      <CardHeader>
        <RefreshCw className="h-8 w-8 text-emerald-600 mb-2" />
        <CardTitle>Sincronização Informakon</CardTitle>
        <CardDescription>
          Replica produtos, estoques e movimentos do ERP sob demanda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {offline
            ? "Serviço de sincronização indisponível."
            : running
              ? "Sincronização em andamento…"
              : lastFinished
                ? `Última sincronização: ${lastFinished}${status?.lastRun?.ok === false ? " (falhou)" : ""}`
                : "Nenhuma sincronização registrada."}
        </p>
        <Button className="w-full" onClick={runSync} disabled={running || offline}>
          {running
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sincronizando…</>
            : <><RefreshCw className="mr-2 h-4 w-4" />Sincronizar agora</>}
        </Button>
        {feedback && (
          <p className={`text-sm flex items-center gap-1.5 ${feedback.ok ? "text-emerald-700" : "text-destructive"}`}>
            {feedback.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {feedback.msg}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
