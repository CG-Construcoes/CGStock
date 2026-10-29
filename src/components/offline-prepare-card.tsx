"use client"

import { useCallback, useEffect, useState } from "react"
import { CloudDownload, RefreshCw, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { localDb, type OfflineSnapshot } from "@/lib/localdb"
import { prepareAllOfflineData, isSnapshotStale } from "@/lib/offline-snapshot"
import { useOnlineStatus } from "@/lib/use-online-status"
import { useSyncUserId } from "@/components/sync-provider"
import { toast } from "sonner"

const MODULE_LABELS: Record<string, string> = {
  collector: "Coletor de Inventário",
  catalog: "Catálogo (produtos, locais, fornecedores, colaboradores)",
  stock: "Saldos de Estoque",
  requests: "Requisições de Material",
  operations: "Movimentações, Entradas, Transferências e Inventários",
  userContext: "Perfil e Permissões Offline",
}

const moduleLabel = (module: string) => MODULE_LABELS[module] ?? module

export function OfflinePrepareCard() {
  const isOnline = useOnlineStatus()
  const userId = useSyncUserId()
  const [snapshots, setSnapshots] = useState<OfflineSnapshot[]>([])
  const [preparing, setPreparing] = useState(false)
  const [now, setNow] = useState(0)

  const reload = useCallback(async () => {
    if (!localDb || !userId) return
    const list = await localDb.snapshots.where("userId").equals(userId).toArray()
    setSnapshots(list.filter((s) => s.module !== "userContext"))
    setNow(Date.now())
  }, [userId])

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0)
    const onUpdated = () => void reload()
    window.addEventListener("cgstock:offline-data-updated", onUpdated)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("cgstock:offline-data-updated", onUpdated)
    }
  }, [reload])

  const prepare = async () => {
    if (!userId || preparing || !isOnline) return
    setPreparing(true)
    try {
      const { moduleNames } = await prepareAllOfflineData(userId)
      toast.success(
        moduleNames.length > 0
          ? `${moduleNames.length} conjunto(s) de dados sincronizados para uso offline neste aparelho.`
          : "Nenhum dado disponível para o seu perfil."
      )
      await reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na preparação dos dados.")
    } finally {
      setPreparing(false)
    }
  }

  return (
    <Card className="mb-6 border-none shadow-sm rounded-md overflow-hidden">
      <CardContent className="p-4 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Dados armazenados neste aparelho (48h+ Offline)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Atualizados automaticamente sempre que há conexão com a internet.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!isOnline || preparing || !userId}
            onClick={() => void prepare()}
          >
            {preparing ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : (
              <CloudDownload className="mr-2 size-4" />
            )}
            {preparing ? "Atualizando..." : "Atualizar agora"}
          </Button>
        </div>
        {snapshots.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Carregando dados para uso sem conexão... Conecte-se à internet para sincronizar o catálogo completo.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {snapshots
              .sort((a, b) => a.module.localeCompare(b.module))
              .map((snapshot) => {
                const stale = now > 0 && isSnapshotStale(snapshot, now)
                return (
                  <li
                    key={snapshot.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5"
                  >
                    <div>
                      <span className="font-medium block text-xs sm:text-sm">{moduleLabel(snapshot.module)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        Atualizado em {new Date(snapshot.downloadedAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <span className={stale ? "text-xs text-amber-600 font-medium" : "text-xs text-emerald-600 font-medium"}>
                      {stale
                        ? "Mais de 72h (Ativo offline)"
                        : `Pronto offline`}
                    </span>
                  </li>
                )
              })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
