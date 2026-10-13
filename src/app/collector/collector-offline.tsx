"use client"

import { useEffect, useState } from "react"
import { CloudDownload, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { localDb, type CollectorSnapshot, type CollectorSnapshotData } from "@/lib/localdb"
import { isCollectorSnapshotUsable, saveOfflineSnapshot } from "@/lib/offline-snapshot"
import { useOnlineStatus } from "@/lib/use-online-status"
import { toast } from "sonner"
import CollectorForm from "./[inventoryId]/[locationId]/collector-form"

export function CollectorOffline({ children, userId, sessionExpiresAt, canPrepare }: {
  children: React.ReactNode
  userId: string
  sessionExpiresAt: string
  canPrepare: boolean
}) {
  const isOnline = useOnlineStatus()
  const [snapshot, setSnapshot] = useState<CollectorSnapshot | undefined>()
  const [selected, setSelected] = useState<{ inventoryId: string; locationId: string; code: string } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!localDb) return
    void localDb.snapshots.get(`${userId}:collector`).then(data => { setSnapshot(data as CollectorSnapshot | undefined); setNow(Date.now()) }).catch(() => {
      toast.error('Não foi possível consultar os dados locais do coletor.')
    })
  }, [userId])

  useEffect(() => {
    if (!snapshot) return
    const remaining = Math.min(new Date(snapshot.expiresAt).getTime(), new Date(sessionExpiresAt).getTime()) - Date.now()
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(remaining, 2147483647)))
    return () => window.clearTimeout(timer)
  }, [snapshot, sessionExpiresAt])

  const prepare = async () => {
    if (!localDb || preparing || !isOnline) return
    setPreparing(true)
    try {
      const response = await fetch('/api/offline/collector', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível preparar o coletor.')
      if (data.userId !== userId || !Array.isArray(data.products) || !Array.isArray(data.inventories)) {
        throw new Error('Dados recebidos para outro usuário ou incompletos.')
      }
      const expiresAt = new Date(Math.min(new Date(data.expiresAt).getTime(), new Date(sessionExpiresAt).getTime()))
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new Error('Sessão expirada. Entre novamente antes de preparar o coletor.')
      }
      const payload: CollectorSnapshotData = { products: data.products, inventories: data.inventories }
      const updated = await saveOfflineSnapshot<CollectorSnapshotData>('collector', userId, payload, expiresAt)
      setSnapshot(updated)
      setNow(Date.now())
      toast.success('Coletor preparado neste aparelho para uso sem rede enquanto esta tela estiver aberta.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha na preparação do coletor.')
    } finally {
      setPreparing(false)
    }
  }

  const ready = now > 0 && isCollectorSnapshotUsable(snapshot, userId, sessionExpiresAt, now)
  if (isOnline) {
    return (
      <div className="min-h-screen bg-accent p-4 font-sans max-w-lg mx-auto">
        <div className="mb-4 rounded-md border border-border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">Coletor neste aparelho</p>
            {canPrepare && <Button type="button" size="sm" disabled={preparing} onClick={() => void prepare()}><CloudDownload className="mr-2 size-4" />{preparing ? 'Preparando...' : 'Preparar dados'}</Button>}
          </div>
          <p className="mt-2 text-muted-foreground">{ready ? `Dados preparados até ${new Date(snapshot!.expiresAt).toLocaleString('pt-BR')}. Deixe esta tela aberta antes de perder a conexão.` : 'Para usar o coletor sem rede, prepare os dados com internet antes da coleta.'}</p>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-accent p-4 font-sans max-w-lg mx-auto">
      {!ready ? (
        <div role="alert" className="rounded-md border border-border bg-card p-6 text-sm">
          <WifiOff className="mb-3 size-6 text-primary" />
          <h2 className="font-bold">Coletor indisponível sem internet</h2>
          <p className="mt-2 text-muted-foreground">Os dados não foram preparados neste aparelho ou sua sessão de 24 horas expirou. Conecte-se e entre novamente para atualizar.</p>
        </div>
      ) : selected ? (
        <CollectorForm key={`${selected.inventoryId}:${selected.locationId}`} userId={userId} sessionExpiresAt={snapshot!.expiresAt.toISOString()} inventoryId={selected.inventoryId} locationId={selected.locationId} locationCode={selected.code} products={snapshot!.data.products} onBack={() => setSelected(null)} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-md bg-primary p-4 text-primary-foreground">
            <h1 className="font-bold">Coletor sem internet</h1>
            <p className="text-sm">Dados preparados em {new Date(snapshot!.downloadedAt).toLocaleString('pt-BR')}. Coletas serão sincronizadas ao reconectar.</p>
          </div>
          {snapshot!.data.inventories.length === 0 && <p className="rounded-md bg-card p-4 text-sm">Nenhum inventário atribuído estava disponível quando os dados foram preparados.</p>}
          {snapshot!.data.inventories.map(inventory => (
            <div key={inventory.id} className="rounded-md border border-border bg-card p-4">
              <h2 className="font-semibold">{inventory.name}</h2>
              <p className="mb-3 text-xs text-muted-foreground">{inventory.code}</p>
              <div className="space-y-2">
                {inventory.locations.map(location => (
                  <button key={location.id} type="button" onClick={() => setSelected({ inventoryId: inventory.id, locationId: location.id, code: location.code })} className="block w-full rounded-md border border-border p-3 text-left text-sm font-medium hover:border-primary">{location.code}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
