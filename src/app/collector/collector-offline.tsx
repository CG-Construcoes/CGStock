"use client"

import { useCallback, useEffect, useState } from "react"
import { CloudDownload, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  localDb,
  type CollectorSnapshot,
  type CollectorSnapshotData,
  type CatalogSnapshotData,
  type StockSnapshotData,
  type OperationsSnapshotData,
} from "@/lib/localdb"
import {
  computeSnapshotExpiry,
  getOfflineSnapshot,
  isSnapshotAvailableOffline,
  isSnapshotStale,
  saveOfflineSnapshot,
} from "@/lib/offline-snapshot"
import { useOnlineStatus } from "@/lib/use-online-status"
import { toast } from "sonner"
import CollectorForm from "./[inventoryId]/[locationId]/collector-form"

export function CollectorOffline({
  children,
  userId,
  sessionExpiresAt,
  canPrepare,
}: {
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

  const loadSnapshot = useCallback(async () => {
    if (!localDb || !userId) return
    try {
      const data = (await localDb.snapshots.get(`${userId}:collector`)) as CollectorSnapshot | undefined
      if (data && data.userId === userId) {
        setSnapshot(data)
        setNow(Date.now())
        return
      }
      // Fallback: reconstrói a visão do coletor a partir dos snapshots catalog + stock + operations
      const [catSnap, stkSnap, opsSnap] = await Promise.all([
        getOfflineSnapshot<CatalogSnapshotData>("catalog", userId),
        getOfflineSnapshot<StockSnapshotData>("stock", userId),
        getOfflineSnapshot<OperationsSnapshotData>("operations", userId),
      ])
      if (catSnap && catSnap.userId === userId) {
        const stocksByProduct = new Map<string, Record<string, number>>()
        for (const s of stkSnap?.data?.items ?? []) {
          const map = stocksByProduct.get(s.productId) ?? {}
          map[s.locationId] = Number(s.quantity)
          stocksByProduct.set(s.productId, map)
        }
        const activeInvs = (opsSnap?.data?.inventories ?? [])
          .filter((inv) => inv.status === "IN_PROGRESS")
          .map((inv) => ({
            id: inv.id,
            code: inv.code,
            name: inv.name,
            status: inv.status,
            locations: inv.locations
              .filter((l) => l.status === "PENDING" || l.status === "IN_PROGRESS")
              .map((l) => ({ id: l.locationId, code: l.code })),
          }))
        const fallbackSnap: CollectorSnapshot = {
          id: `${userId}:collector`,
          userId,
          module: "collector",
          downloadedAt: catSnap.downloadedAt,
          expiresAt: catSnap.expiresAt,
          data: {
            products: (catSnap.data.products ?? []).map((p) => ({
              id: p.id,
              code: p.code,
              barcode: p.barcode,
              name: p.name,
              unitCode: p.unitCode,
              locationStocks: stocksByProduct.get(p.id) ?? {},
            })),
            inventories: activeInvs,
          },
        }
        setSnapshot(fallbackSnap)
      }
      setNow(Date.now())
    } catch {
      toast.error("Não foi possível consultar os dados locais do coletor.")
    }
  }, [userId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSnapshot(), 0)
    const onUpdated = () => void loadSnapshot()
    window.addEventListener("cgstock:offline-data-updated", onUpdated)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("cgstock:offline-data-updated", onUpdated)
    }
  }, [loadSnapshot])

  const prepare = async () => {
    if (!localDb || preparing || !isOnline) return
    setPreparing(true)
    try {
      const response = await fetch("/api/offline/collector", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível preparar o coletor.")
      if (data.userId !== userId || !Array.isArray(data.products) || !Array.isArray(data.inventories)) {
        throw new Error("Dados recebidos para outro usuário ou incompletos.")
      }
      const expiresAt = computeSnapshotExpiry(data.expiresAt || sessionExpiresAt)
      const payload: CollectorSnapshotData = { products: data.products, inventories: data.inventories }
      const updated = await saveOfflineSnapshot<CollectorSnapshotData>("collector", userId, payload, expiresAt)
      setSnapshot(updated)
      setNow(Date.now())
      toast.success("Coletor atualizado neste aparelho para operação offline.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na preparação do coletor.")
    } finally {
      setPreparing(false)
    }
  }

  const availableOffline = isSnapshotAvailableOffline(snapshot, userId)
  const stale = now > 0 && isSnapshotStale(snapshot, now)

  if (isOnline) {
    return (
      <div className="min-h-screen bg-accent p-4 font-sans max-w-lg mx-auto">
        <div className="mb-4 rounded-md border border-border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">Coletor neste aparelho</p>
            {canPrepare && (
              <Button type="button" size="sm" disabled={preparing} onClick={() => void prepare()}>
                <CloudDownload className="mr-2 size-4" />
                {preparing ? "Atualizando..." : "Atualizar dados"}
              </Button>
            )}
          </div>
          <p className="mt-2 text-muted-foreground">
            {availableOffline
              ? `Dados armazenados no dispositivo (atualizados em ${new Date(snapshot!.downloadedAt).toLocaleString("pt-BR")}). Você pode fechar e abrir o app sem internet.`
              : "Sincronizando dados do coletor para uso sem rede..."}
          </p>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-accent p-4 font-sans max-w-lg mx-auto">
      {!availableOffline ? (
        <div role="alert" className="rounded-md border border-border bg-card p-6 text-sm">
          <WifiOff className="mb-3 size-6 text-primary" />
          <h2 className="font-bold">Coletor indisponível sem internet</h2>
          <p className="mt-2 text-muted-foreground">
            Os dados ainda não foram baixados neste aparelho. Conecte-se à internet pelo menos uma vez para carregar os dados.
          </p>
        </div>
      ) : selected ? (
        <CollectorForm
          key={`${selected.inventoryId}:${selected.locationId}`}
          userId={userId}
          sessionExpiresAt={snapshot!.expiresAt.toISOString()}
          inventoryId={selected.inventoryId}
          locationId={selected.locationId}
          locationCode={selected.code}
          products={snapshot!.data.products}
          onBack={() => setSelected(null)}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-md bg-primary p-4 text-primary-foreground">
            <h1 className="font-bold">Coletor sem internet</h1>
            <p className="text-sm">
              Dados de {new Date(snapshot!.downloadedAt).toLocaleString("pt-BR")}. Coletas são salvas no dispositivo e sincronizadas automaticamente ao reconectar.
            </p>
          </div>
          {stale && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              Atenção: os dados locais têm mais de 48h/72h sem atualização. Você pode continuar coletando normalmente; tudo será sincronizado assim que houver conexão.
            </div>
          )}
          {snapshot!.data.inventories.length === 0 && (
            <p className="rounded-md bg-card p-4 text-sm">
              Nenhum inventário com locais pendentes no momento.
            </p>
          )}
          {snapshot!.data.inventories.map((inventory) => (
            <div key={inventory.id} className="rounded-md border border-border bg-card p-4">
              <h2 className="font-semibold">{inventory.name}</h2>
              <p className="mb-3 text-xs text-muted-foreground">{inventory.code}</p>
              {inventory.locations.length === 0 ? (
                <p className="text-xs text-muted-foreground">Todos os locais deste inventário já foram coletados neste dispositivo.</p>
              ) : (
                <div className="space-y-2">
                  {inventory.locations.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => setSelected({ inventoryId: inventory.id, locationId: location.id, code: location.code })}
                      className="block w-full rounded-md border border-border p-3 text-left text-sm font-medium hover:border-primary"
                    >
                      {location.code}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
