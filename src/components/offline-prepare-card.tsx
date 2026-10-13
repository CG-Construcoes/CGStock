"use client"

import { useCallback, useEffect, useState } from "react"
import { CloudDownload, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { localDb, type OfflineSnapshot } from "@/lib/localdb"
import { saveOfflineSnapshot } from "@/lib/offline-snapshot"
import { useOnlineStatus } from "@/lib/use-online-status"
import { useSyncUserId } from "@/components/sync-provider"
import { toast } from "sonner"

const MODULE_LABELS: Record<string, string> = {
  collector: "Coletor",
  catalog: "Catálogo (produtos, locais, fornecedores)",
  stock: "Saldo de estoque",
  requests: "Requisições"
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
    setSnapshots(await localDb.snapshots.where('userId').equals(userId).toArray())
    setNow(Date.now())
  }, [userId])

  useEffect(() => {
    if (!localDb || !userId) return
    void localDb.snapshots.where('userId').equals(userId).toArray()
      .then(data => { setSnapshots(data); setNow(Date.now()) })
      .catch(() => toast.error('Não foi possível consultar os dados locais.'))
  }, [userId])

  const prepare = async () => {
    if (!userId || preparing || !isOnline) return
    setPreparing(true)
    try {
      const response = await fetch('/api/offline/prepare', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Não foi possível preparar os dados.')
      if (body.userId !== userId || typeof body.modules !== 'object' || !body.modules) {
        throw new Error('Dados recebidos para outro usuário ou incompletos.')
      }
      const expiresAt = new Date(Math.min(new Date(body.expiresAt).getTime(), Date.now() + 24 * 60 * 60 * 1000))
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new Error('Sessão expirada. Entre novamente antes de preparar os dados.')
      }
      const moduleNames = Object.keys(body.modules)
      for (const moduleName of moduleNames) {
        await saveOfflineSnapshot(moduleName, userId, body.modules[moduleName], expiresAt)
      }
      toast.success(moduleNames.length > 0 ? `${moduleNames.length} conjunto(s) de dados preparados neste aparelho.` : 'Nenhum dado disponível para o seu perfil.')
      await reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha na preparação dos dados.')
    } finally {
      setPreparing(false)
    }
  }

  return (
    <Card className="mb-6 border-none shadow-sm rounded-md overflow-hidden">
      <CardContent className="p-4 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-sm">Dados preparados neste aparelho</p>
          <Button type="button" size="sm" variant="outline" disabled={!isOnline || preparing || !userId} onClick={() => void prepare()}>
            {preparing ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <CloudDownload className="mr-2 size-4" />}
            {preparing ? 'Preparando...' : 'Preparar dados'}
          </Button>
        </div>
        {snapshots.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Prepare os dados com internet antes de trabalhar sem conexão. As informações ficam disponíveis somente para o seu usuário neste aparelho.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {snapshots.sort((a, b) => a.module.localeCompare(b.module)).map(snapshot => {
              const expired = now > 0 && snapshot.expiresAt.getTime() <= now
              return (
                <li key={snapshot.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                  <span className="font-medium">{moduleLabel(snapshot.module)}</span>
                  <span className={expired ? 'text-xs text-red-600' : 'text-xs text-muted-foreground'}>
                    {expired ? 'Expirado — prepare novamente' : `Até ${snapshot.expiresAt.toLocaleString('pt-BR')}`}
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
