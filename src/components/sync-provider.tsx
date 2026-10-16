"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { localDb } from "@/lib/localdb"
import { useOnlineStatus } from "@/lib/use-online-status"
import { toast } from "sonner"
import { WifiOff, Loader2 } from "lucide-react"

const SyncUserContext = createContext<string | null>(null)

export function useSyncUserId() { return useContext(SyncUserContext) }

export function SyncProvider({ children, userId }: { children: React.ReactNode; userId: string | null }) {
  const isOnline = useOnlineStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const syncing = useRef(false)

  const updatePendingCount = useCallback(async () => {
    if (!localDb || !userId) {
      setPendingCount(0)
      return
    }
    const count = await localDb.syncQueue.where('userId').equals(userId).filter(task => task.status === 'PENDING' || task.status === 'ERROR' || task.status === 'CONFLICT').count()
    setPendingCount(count)
  }, [userId])

  const syncNow = useCallback(async () => {
    if (!isOnline || !localDb || !userId || syncing.current) return
    syncing.current = true
    let successCount = 0
    try {
      await localDb.syncQueue.where('userId').equals(userId)
        .filter(task => task.status === 'SYNCING' && (!task.lastAttemptAt || Date.now() - new Date(task.lastAttemptAt).getTime() > 120000))
        .modify({ status: 'PENDING' })
      const pendingTasks = (await localDb.syncQueue
        .where('userId').equals(userId)
        .filter(task => task.status === 'PENDING' || task.status === 'ERROR')
        .toArray()).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      if (pendingTasks.length > 0) setIsSyncing(true)

      for (const task of pendingTasks) {
        let unauthorized = false
        let conflict = false
        try {
          await localDb.syncQueue.update(task.id!, { status: 'SYNCING', lastAttemptAt: new Date() })

          // Dynamic API call based on operation type
          const endpointMap: Record<string, string> = {
            'CREATE_RECEIPT': '/api/sync/receipt',
            'CREATE_REQUEST': '/api/sync/request',
            'CREATE_ADJUSTMENT': '/api/sync/adjustment',
            'CREATE_TRANSFER': '/api/sync/transfer',
            'CREATE_RETURN': '/api/sync/return',
            'CREATE_QUICK_ISSUE': '/api/sync/quick-issue',
            'FULFILL_REQUEST': '/api/sync/fulfill',
            'REQUEST_STATUS': '/api/sync/request-status',
            'SUBMIT_COLLECTION': '/api/sync'
          }
          const endpoint = endpointMap[task.operation]
          if (!endpoint) throw new Error("Operação de sincronização desconhecida")

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operation: task.operation, payload: task.payload, idempotencyKey: task.entityId, userId: task.userId })
          })
          unauthorized = res.status === 401 || res.status === 403
          conflict = res.status === 409
          if (unauthorized) throw new Error("Sessão ou permissão inválida. Faça login novamente para sincronizar.")
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || "Falha na sincronização")
          }

          await localDb.syncQueue.delete(task.id!)
          successCount++
        } catch (err) {
          console.error("Sync error:", err)
          await localDb.syncQueue.update(task.id!, {
            status: conflict ? 'CONFLICT' : 'ERROR',
            error: err instanceof Error ? err.message : "Falha na sincronização",
            attempts: task.attempts + 1,
            lastAttemptAt: new Date()
          })
          if (unauthorized) break
        }
      }
      if (successCount > 0) toast.success(`${successCount} operações sincronizadas com o servidor.`)
    } catch {
      toast.error("Não foi possível acessar a fila local. Verifique o armazenamento do dispositivo.")
    } finally {
      syncing.current = false
      setIsSyncing(false)
      void updatePendingCount()
      window.dispatchEvent(new Event('cgstock:sync-finished'))
    }
  }, [isOnline, updatePendingCount, userId])

  useEffect(() => {
    const requestSync = () => { void syncNow() }
    window.addEventListener('cgstock:sync', requestSync)
    return () => window.removeEventListener('cgstock:sync', requestSync)
  }, [syncNow])

  useEffect(() => {
    if (!isOnline) return
    const timer = window.setTimeout(() => { void syncNow() }, 0)
    return () => window.clearTimeout(timer)
  }, [isOnline, syncNow])

  useEffect(() => {
    if (!userId) {
      setPendingCount(0)
      return
    }
    const loadInitialCount = async () => {
      if (!localDb) return
      const count = await localDb.syncQueue.where('userId').equals(userId).filter(task => task.status === 'PENDING' || task.status === 'ERROR' || task.status === 'CONFLICT').count()
      setPendingCount(count)
    }
    void loadInitialCount()

    const handleOnline = () => {
      toast.success("Conexão restabelecida!")
      syncNow()
    }
    const handleOffline = () => {
      toast.error("Sem conexão. Entradas e coletas já abertas podem ser salvas; as demais telas exigem internet.")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Polling backup
    const interval = setInterval(updatePendingCount, 5000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval)
    }
  }, [syncNow, updatePendingCount, userId])

  return (
    <SyncUserContext.Provider value={userId}>
      {/* Global Indicator */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        {!isOnline && (
          <div className="flex items-center gap-2 bg-rose-500 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-bold animate-in fade-in slide-in-from-bottom-4">
            <WifiOff className="h-4 w-4" />
            OFFLINE
            {pendingCount > 0 && <span className="bg-white text-rose-500 px-1.5 rounded-full ml-1">{pendingCount}</span>}
          </div>
        )}
        
        {isOnline && isSyncing && (
          <div className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-bold animate-in fade-in slide-in-from-bottom-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            SINCRONIZANDO...
          </div>
        )}
      </div>
      {children}
    </SyncUserContext.Provider>
  )
}
