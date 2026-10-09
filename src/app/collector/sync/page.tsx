"use client"

import { useEffect, useState } from "react"
import { localDb, type SyncQueueTask } from "@/lib/localdb"
import { useOnlineStatus } from "@/lib/use-online-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {  RefreshCw, CheckCircle2, CloudOff, Cloud, AlertCircle } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"

export default function SyncPage() {
  const isOnline = useOnlineStatus()
  const [tasks, setTasks] = useState<SyncQueueTask[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  const loadTasks = async () => {
    if (localDb) {
      const q = await localDb.syncQueue.toArray()
      setTasks(q.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
    }
  }

  useEffect(() => {
    const loadInitialTasks = async () => {
      if (localDb) {
        const q = await localDb.syncQueue.toArray()
        setTasks(q.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
      }
    }
    void loadInitialTasks()
  }, [])

  const syncNow = async () => {
    if (!isOnline || !localDb) return
    setIsSyncing(true)
    
    const pendingTasks = await localDb.syncQueue.where('status').anyOf(['PENDING', 'ERROR']).toArray()

    for (const task of pendingTasks) {
      if (!task.id) continue
      
      await localDb.syncQueue.update(task.id, { status: 'SYNCING' })
      
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: task.operation, payload: task.payload })
        })
        
        if (res.ok) {
          await localDb.syncQueue.update(task.id, { status: 'SYNCED', lastAttemptAt: new Date() })
        } else {
          const data = await res.json()
          await localDb.syncQueue.update(task.id, { 
            status: 'ERROR', 
            error: data.error, 
            attempts: task.attempts + 1,
            lastAttemptAt: new Date()
          })
        }
      } catch (err) {
        await localDb.syncQueue.update(task.id, {
          status: 'ERROR',
          error: err instanceof Error ? err.message : "Erro desconhecido",
          attempts: task.attempts + 1,
          lastAttemptAt: new Date()
        })
      }
    }
    
    await loadTasks()
    setIsSyncing(false)
  }

  const pendingCount = tasks.filter(t => t.status === 'PENDING' || t.status === 'ERROR').length

  return (
    <div className="min-h-screen bg-accent p-4 font-sans max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <h1 className="text-xl font-bold">Status do Coletor</h1>
      </div>

      <Card className="mb-6 border-none shadow-sm rounded-md overflow-hidden">
        <div className={`p-4 flex items-center justify-between text-white ${isOnline ? 'bg-emerald-600' : 'bg-red-500'}`}>
          <div className="flex items-center gap-3">
            {isOnline ? <Cloud className="h-6 w-6" /> : <CloudOff className="h-6 w-6" />}
            <span className="font-bold text-lg">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <Badge variant="outline" className="text-white border-white/30 bg-card/10">
            {pendingCount} Pendentes
          </Badge>
        </div>
        <CardContent className="p-4 bg-card">
          <p className="text-sm text-muted-foreground mb-4">
            {isOnline 
              ? "Você tem conexão. Pode sincronizar suas coletas locais com o servidor."
              : "Sem internet. Suas coletas estão sendo salvas localmente."}
          </p>
          <Button 
            onClick={syncNow} 
            disabled={!isOnline || isSyncing || pendingCount === 0} 
            className="w-full h-12 bg-primary hover:bg-primary"
          >
            {isSyncing ? (
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5 mr-2" />
            )}
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </Button>
        </CardContent>
      </Card>

      <h2 className="text-muted-foreground font-semibold mb-4 ml-1">Fila de Sincronização</h2>
      
      {tasks.length === 0 ? (
        <div className="text-center p-8 bg-muted rounded-md text-muted-foreground border border-dashed">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Nenhuma coleta na fila.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} className="bg-card p-4 rounded-md shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">{task.operation === 'SUBMIT_COLLECTION' ? 'Envio de Coleta' : task.operation}</p>
                <p className="text-xs text-muted-foreground">{new Date(task.createdAt).toLocaleString()}</p>
                {task.error && <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate">{task.error}</p>}
              </div>
              <div>
                {task.status === 'SYNCED' && <Badge variant="success">Sincronizado</Badge>}
                {task.status === 'PENDING' && <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>}
                {task.status === 'ERROR' && <Badge variant="destructive" className="flex gap-1 items-center"><AlertCircle className="h-3 w-3"/> Erro ({task.attempts})</Badge>}
                {task.status === 'SYNCING' && <Badge variant="secondary" className="">Enviando</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
