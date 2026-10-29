"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { localDb } from "@/lib/localdb"
import { useOnlineStatus } from "@/lib/use-online-status"
import {
  SYNC_ENDPOINT_MAP,
  sortSyncTasksWithDependencies,
  resolveDependentPayload,
  registerBackgroundSync,
} from "@/lib/offline-sync"
import { prepareAllOfflineData } from "@/lib/offline-snapshot"
import { toast } from "sonner"
import { WifiOff, Loader2, AlertTriangle } from "lucide-react"
import Link from "next/link"

const SyncUserContext = createContext<string | null>(null)

export function useSyncUserId() {
  return useContext(SyncUserContext)
}

export function SyncProvider({ children, userId }: { children: React.ReactNode; userId: string | null }) {
  const isOnline = useOnlineStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [conflictCount, setConflictCount] = useState(0)
  const syncing = useRef(false)
  const preparingRef = useRef(false)
  const lastPreparedAtRef = useRef(0)
  const retryTimerRef = useRef<number | null>(null)

  const updatePendingCount = useCallback(async () => {
    if (!localDb || !userId) {
      setPendingCount(0)
      setConflictCount(0)
      return
    }
    const allTasks = await localDb.syncQueue.where("userId").equals(userId).toArray()
    const pending = allTasks.filter(
      (task) => task.status === "PENDING" || task.status === "ERROR" || task.status === "SYNCING"
    ).length
    const conflicts = allTasks.filter((task) => task.status === "CONFLICT").length
    setPendingCount(pending + conflicts)
    setConflictCount(conflicts)
  }, [userId])

  const ensureOfflineDataPrepared = useCallback(
    async (force = false) => {
      if (!isOnline || !localDb || !userId || preparingRef.current) return
      const now = Date.now()
      if (!force && now - lastPreparedAtRef.current < 120_000) {
        const existingCatalog = await localDb.snapshots.get(`${userId}:catalog`)
        const existingOps = await localDb.snapshots.get(`${userId}:operations`)
        if (existingCatalog && existingOps && now - new Date(existingCatalog.downloadedAt).getTime() < 300_000) {
          return
        }
      }
      preparingRef.current = true
      try {
        await prepareAllOfflineData(userId)
        lastPreparedAtRef.current = Date.now()
      } catch {
        // Silencioso em segundo plano
      } finally {
        preparingRef.current = false
      }
    },
    [isOnline, userId]
  )

  const executeSyncQueue = useCallback(async () => {
    if (!isOnline || !localDb || !userId || syncing.current) return
    syncing.current = true
    let successCount = 0
    let transientErrors = 0
    let minAttempts = 1

    try {
      // Recupera tarefas que ficaram presas em SYNCING por queda abrupta (> 30s)
      await localDb.syncQueue
        .where("userId")
        .equals(userId)
        .filter(
          (task) =>
            task.status === "SYNCING" &&
            (!task.lastAttemptAt || Date.now() - new Date(task.lastAttemptAt).getTime() > 30_000)
        )
        .modify({ status: "PENDING" })

      const rawTasks = await localDb.syncQueue
        .where("userId")
        .equals(userId)
        .filter((task) => task.status === "PENDING" || task.status === "ERROR")
        .toArray()

      const pendingTasks = sortSyncTasksWithDependencies(rawTasks)
      if (pendingTasks.length > 0) setIsSyncing(true)

      const idMappings = new Map<string, string>()
      const blockedTempIds = new Set<string>()

      for (const task of pendingTasks) {
        if (!navigator.onLine) break
        if (task.dependsOnEntityId && blockedTempIds.has(task.dependsOnEntityId)) {
          continue
        }

        let unauthorized = false
        let conflict = false
        try {
          const resolvedPayload = resolveDependentPayload(task.payload, idMappings)
          await localDb.syncQueue.update(task.id!, {
            status: "SYNCING",
            payload: resolvedPayload,
            lastAttemptAt: new Date(),
          })

          const endpoint = SYNC_ENDPOINT_MAP[task.operation]
          if (!endpoint) throw new Error("Operação de sincronização desconhecida")

          const controller = new AbortController()
          const timeoutId = window.setTimeout(() => controller.abort(), 25_000)

          let res: Response
          try {
            res = await fetch(endpoint, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                operation: task.operation,
                payload: resolvedPayload,
                idempotencyKey: task.entityId,
                userId: task.userId,
              }),
              signal: controller.signal,
            })
          } finally {
            window.clearTimeout(timeoutId)
          }

          unauthorized = res.status === 401 || res.status === 403
          conflict = res.status === 409
          if (unauthorized) {
            throw new Error("Sessão ou permissão inválida. Faça login novamente para sincronizar.")
          }
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || "Falha na sincronização")
          }

          const body = await res.json().catch(() => ({}))
          const serverId = body.inventoryId || body.requestId || body.receiptId || body.issueId
          if (task.clientTempId && typeof serverId === "string") {
            idMappings.set(task.clientTempId, serverId)
            // Atualiza tarefas dependentes no IndexedDB imediatamente
            const dependents = await localDb.syncQueue
              .where("userId")
              .equals(userId)
              .filter((t) => t.dependsOnEntityId === task.clientTempId)
              .toArray()
            for (const dep of dependents) {
              await localDb.syncQueue.update(dep.id!, {
                payload: resolveDependentPayload(dep.payload, idMappings),
                dependsOnEntityId: undefined,
              })
            }
          }

          await localDb.syncQueue.delete(task.id!)
          successCount++
        } catch (err) {
          console.error("Sync error:", err)
          if (task.clientTempId) blockedTempIds.add(task.clientTempId)
          const nextAttempts = (task.attempts || 0) + 1
          await localDb.syncQueue.update(task.id!, {
            status: conflict ? "CONFLICT" : "ERROR",
            error: err instanceof Error ? err.message : "Falha na sincronização",
            attempts: nextAttempts,
            lastAttemptAt: new Date(),
          })
          if (!conflict && !unauthorized) {
            transientErrors++
            minAttempts = Math.max(minAttempts, nextAttempts)
          }
          if (unauthorized) break
        }
      }

      if (successCount > 0) {
        toast.success(
          `${successCount} ${successCount === 1 ? "operação sincronizada" : "operações sincronizadas"} com o servidor.`
        )
        await ensureOfflineDataPrepared(true)
      }
    } catch {
      toast.error("Não foi possível acessar a fila local. Verifique o armazenamento do dispositivo.")
    } finally {
      syncing.current = false
      setIsSyncing(false)
      void updatePendingCount()
      window.dispatchEvent(new Event("cgstock:sync-finished"))

      if (transientErrors > 0 && navigator.onLine) {
        if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current)
        const backoffMs = Math.min(60_000, 3_000 * Math.pow(2, Math.min(minAttempts, 4)))
        retryTimerRef.current = window.setTimeout(() => {
          void executeSyncQueue()
        }, backoffMs)
        void registerBackgroundSync()
      }
    }
  }, [ensureOfflineDataPrepared, isOnline, updatePendingCount, userId])

  const syncNow = useCallback(async () => {
    if (!isOnline || !localDb || !userId || syncing.current) return
    if (typeof navigator !== "undefined" && "locks" in navigator && navigator.locks?.request) {
      await navigator.locks.request("cgstock-sync-lock", { ifAvailable: true }, async (lock) => {
        if (!lock) return
        await executeSyncQueue()
      })
      return
    }
    await executeSyncQueue()
  }, [executeSyncQueue, isOnline, userId])

  useEffect(() => {
    const requestSync = () => {
      void syncNow()
    }
    window.addEventListener("cgstock:sync", requestSync)
    window.addEventListener("cgstock:queue-updated", updatePendingCount)
    return () => {
      window.removeEventListener("cgstock:sync", requestSync)
      window.removeEventListener("cgstock:queue-updated", updatePendingCount)
    }
  }, [syncNow, updatePendingCount])

  // Sincronização automática e preparação automática de dados locais ao iniciar/reconectar
  useEffect(() => {
    if (!isOnline || !userId) return
    const timer = window.setTimeout(async () => {
      await syncNow()
      await ensureOfflineDataPrepared(false)
    }, 50)
    return () => window.clearTimeout(timer)
  }, [ensureOfflineDataPrepared, isOnline, syncNow, userId])

  useEffect(() => {
    if (!userId) return

    const initTimer = window.setTimeout(() => void updatePendingCount(), 0)

    const handleOnline = () => {
      toast.success("Conexão restabelecida! Sincronizando dados automaticamente...")
      void syncNow()
    }
    const handleOffline = () => {
      toast.info(
        "Modo offline ativado. Você pode continuar trabalhando normalmente; todas as operações ficam salvas neste aparelho."
      )
    }
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void syncNow()
        void ensureOfflineDataPrepared(false)
      }
    }
    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data
      if (data && data.type === "CGSTOCK_SW_SYNC_COMPLETED") {
        void updatePendingCount()
        void ensureOfflineDataPrepared(true)
        window.dispatchEvent(new Event("cgstock:sync-finished"))
      }
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("focus", handleVisibilityOrFocus)
    document.addEventListener("visibilitychange", handleVisibilityOrFocus)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSwMessage)
    }

    const interval = window.setInterval(() => {
      void updatePendingCount()
      if (navigator.onLine && !syncing.current) {
        void syncNow()
      }
    }, 8_000)

    return () => {
      window.clearTimeout(initTimer)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("focus", handleVisibilityOrFocus)
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus)
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage)
      }
      window.clearInterval(interval)
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current)
    }
  }, [ensureOfflineDataPrepared, syncNow, updatePendingCount, userId])

  return (
    <SyncUserContext.Provider value={userId}>
      <div className="fixed bottom-20 lg:bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {!isOnline && (
          <Link
            href="/collector/sync"
            className="flex items-center gap-2 bg-rose-600 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-bold animate-in fade-in slide-in-from-bottom-4"
          >
            <WifiOff className="h-4 w-4" />
            OFFLINE
            {pendingCount > 0 && (
              <span className="bg-white text-rose-600 px-1.5 py-0.5 rounded-full ml-1">{pendingCount}</span>
            )}
          </Link>
        )}

        {isOnline && isSyncing && (
          <div className="flex items-center gap-2 bg-blue-600 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-bold animate-in fade-in slide-in-from-bottom-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            SINCRONIZANDO...
          </div>
        )}

        {isOnline && !isSyncing && conflictCount > 0 && (
          <Link
            href="/collector/sync"
            className="flex items-center gap-2 bg-amber-600 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-bold animate-in fade-in slide-in-from-bottom-4"
          >
            <AlertTriangle className="h-4 w-4" />
            {conflictCount} CONFLITO(S)
          </Link>
        )}
      </div>
      {children}
    </SyncUserContext.Provider>
  )
}
