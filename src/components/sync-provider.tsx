"use client"

import { useEffect, useState, useCallback } from "react"
import { localDb } from "@/lib/localdb"
import { useOnlineStatus } from "@/lib/use-online-status"
import { toast } from "sonner"
import { WifiOff, Loader2 } from "lucide-react"

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const updatePendingCount = useCallback(async () => {
    if (!localDb) return
    const count = await localDb.syncQueue.where('status').equals('PENDING').count()
    const errorCount = await localDb.syncQueue.where('status').equals('ERROR').count()
    setPendingCount(count + errorCount)
  }, [])

  const syncNow = useCallback(async () => {
    if (!isOnline || !localDb) return
    
    const pendingTasks = await localDb.syncQueue
      .where('status').anyOf(['PENDING', 'ERROR'])
      .toArray()
      
    if (pendingTasks.length === 0) return

    setIsSyncing(true)
    let successCount = 0

    for (const task of pendingTasks) {
      try {
        await localDb.syncQueue.update(task.id!, { status: 'SYNCING' })
        
        // Dynamic API call based on operation type
        const endpointMap: Record<string, string> = {
          'CREATE_RECEIPT': '/api/sync/receipt',
          'SUBMIT_COLLECTION': '/api/sync'
        }

        const endpoint = endpointMap[task.operation]
        if (!endpoint) throw new Error("Operação de sincronização desconhecida")

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: task.operation, payload: task.payload, idempotencyKey: task.entityId })
        })

        if (res.status === 401) {
          throw new Error("Sessão expirada. Faça login novamente para sincronizar.")
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Falha na sincronização")
        }

        await localDb.syncQueue.delete(task.id!)
        successCount++
      } catch (err) {
        console.error("Sync error:", err)
        await localDb.syncQueue.update(task.id!, {
          status: 'ERROR',
          error: err instanceof Error ? err.message : "Falha na sincronização",
          attempts: task.attempts + 1,
          lastAttemptAt: new Date()
        })
      }
    }

    setIsSyncing(false)
    updatePendingCount()
    
    if (successCount > 0) {
      toast.success(`${successCount} operações sincronizadas com o servidor.`)
    }
  }, [isOnline, updatePendingCount])

  useEffect(() => {
    const loadInitialCount = async () => {
      if (!localDb) return
      const count = await localDb.syncQueue.where('status').equals('PENDING').count()
      const errorCount = await localDb.syncQueue.where('status').equals('ERROR').count()
      setPendingCount(count + errorCount)
    }
    void loadInitialCount()

    const handleOnline = () => {
      toast.success("Conexão restabelecida!")
      syncNow()
    }
    const handleOffline = () => {
      toast.error("Sem conexão. O sistema operará em modo offline.")
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
  }, [syncNow, updatePendingCount])

  return (
    <>
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
    </>
  )
}
