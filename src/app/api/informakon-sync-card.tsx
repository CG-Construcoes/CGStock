"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

type SyncProgress = {
  running: boolean
  startedAt: string | null
  source: string | null
  entity: string | null
  phase: "idle" | "fetch" | "project"
  entityTotal: number
  entityPending: number
  entityDone: number
  entitiesDone: number
  entitiesPlanned: number
  projectedTotal: number
  remainingEstimate: number
}

type SyncStatus = {
  enabled: boolean
  running: boolean
  sources?: string[]
  progress?: SyncProgress
  lastRun?: {
    startedAt?: string
    finishedAt?: string
    ok?: boolean
  }
}

const ENTITY_LABELS: Record<string, string> = {
  unidade: "Unidades",
  categoria: "Categorias",
  obra: "Obras",
  centro: "Almoxarifados",
  insumo: "Produtos",
  fornecedor: "Fornecedores",
  funcionario: "Funcionários",
  estoque: "Saldos de estoque",
  entradaItem: "Entradas",
  saidaItem: "Saídas",
}

function fmtTime(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  })
}

function fmtDuration(totalSec: number) {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "—"
  if (totalSec < 60) return "< 1 min"
  const min = Math.round(totalSec / 60)
  if (min < 60) return `~${min} min`
  const h = Math.floor(min / 60)
  return `~${h}h ${min % 60}min`
}

export function InformakonSyncCard() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const [now, setNow] = useState(() => Date.now())

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

  const running = loading || status?.running || status?.progress?.running

  // Enquanto houver ciclo rodando, reconsulta o status a cada 5s
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      setNow(Date.now())
      void refresh()
    }, 5000)
    return () => clearInterval(t)
  }, [running, refresh])

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

  const lastFinished = fmtTime(status?.lastRun?.finishedAt)
  const p = status?.progress

  // progresso total do ciclo: projetados ÷ (projetados + estimativa restante)
  const doneTotal = p ? p.projectedTotal : 0
  const totalEstimate = p ? doneTotal + p.remainingEstimate : 0
  const pct = totalEstimate > 0 ? Math.min(100, (doneTotal / totalEstimate) * 100) : 0

  // ETA: taxa medida neste ciclo (itens/s) × restante estimado
  const elapsedSec = p?.startedAt ? (now - new Date(p.startedAt).getTime()) / 1000 : 0
  const rate = elapsedSec > 5 ? doneTotal / elapsedSec : 0
  const eta = rate > 0 ? fmtDuration(p!.remainingEstimate / rate) : "estimando…"
  const elapsed = elapsedSec > 0 ? fmtDuration(elapsedSec) : null

  const entityName = p?.entity ? (ENTITY_LABELS[p.entity] ?? p.entity) : null

  return (
    <Card>
      <CardHeader>
        <RefreshCw className="h-8 w-8 text-emerald-600 mb-2" />
        <CardTitle>Sincronização Informakon</CardTitle>
        <CardDescription>
          Replica produtos, estoques e movimentos do ERP sob demanda
          {status?.sources?.length ? ` — bases: ${status.sources.join(", ")}` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {running && p ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {p.phase === "fetch"
                  ? `Lendo ${p.source} · ${entityName ?? "…"} do SQL Server…`
                  : p.source && entityName
                    ? `${p.source} · ${entityName} — ${p.entityDone.toLocaleString("pt-BR")}/${p.entityPending.toLocaleString("pt-BR")} itens`
                    : "Sincronização em andamento…"}
              </span>
              <span>
                etapa {p.entitiesDone + 1}/{p.entitiesPlanned}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {doneTotal.toLocaleString("pt-BR")} itens sincronizados
                {elapsed ? ` · decorrido ${elapsed}` : ""}
              </span>
              <span>restam {eta}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {offline
              ? "Serviço de sincronização indisponível."
              : lastFinished
                ? `Última sincronização: ${lastFinished}${status?.lastRun?.ok === false ? " (falhou)" : ""}`
                : "Nenhuma sincronização registrada."}
          </p>
        )}
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
