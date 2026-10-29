"use client"

import { useEffect, useState } from "react"
import { localDb, type SyncQueueTask } from "@/lib/localdb"
import { useSyncUserId } from "@/components/sync-provider"
import { useOnlineStatus } from "@/lib/use-online-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {  RefreshCw, CheckCircle2, CloudOff, Cloud, AlertCircle } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { OfflinePrepareCard } from "@/components/offline-prepare-card"
import Link from "next/link"
import { toast } from "sonner"

export default function SyncPage() {
  const isOnline = useOnlineStatus()
  const userId = useSyncUserId()
  const [tasks, setTasks] = useState<SyncQueueTask[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [unownedCount, setUnownedCount] = useState(0)

  useEffect(() => {
    const loadTasks = async () => {
      if (!localDb) return
      const q = userId ? await localDb.syncQueue.where('userId').equals(userId).toArray() : []
      setTasks(q.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
      setUnownedCount(await localDb.syncQueue.filter(task => !task.userId).count())
    }
    void loadTasks()
    const finished = () => { void loadTasks(); setIsSyncing(false) }
    window.addEventListener('cgstock:sync-finished', finished)
    window.addEventListener('cgstock:queue-updated', loadTasks)
    return () => {
      window.removeEventListener('cgstock:sync-finished', finished)
      window.removeEventListener('cgstock:queue-updated', loadTasks)
    }
  }, [userId])

  const syncNow = () => {
    if (!isOnline) return
    setIsSyncing(true)
    window.dispatchEvent(new Event('cgstock:sync'))
  }

  const discardConflict = async (task: SyncQueueTask) => {
    if (!localDb || task.userId !== userId || task.status !== 'CONFLICT' || !task.id) return
    if (!window.confirm('Descartar esta operação local? Faça isso somente depois de conferir os dados registrados no servidor. Esta ação não pode ser desfeita.')) return
    try {
      await localDb.syncQueue.delete(task.id)
      setTasks(current => current.filter(item => item.id !== task.id))
      window.dispatchEvent(new Event('cgstock:queue-updated'))
      toast.success('Operação local descartada após revisão.')
    } catch {
      toast.error('Não foi possível descartar a operação. Tente novamente.')
    }
  }

  const retryConflict = async (task: SyncQueueTask) => {
    if (!localDb || task.userId !== userId || !task.id) return
    try {
      await localDb.syncQueue.update(task.id, { status: 'PENDING', error: undefined })
      setTasks(current => current.map(item => item.id === task.id ? { ...item, status: 'PENDING', error: undefined } : item))
      window.dispatchEvent(new Event('cgstock:queue-updated'))
      if (navigator.onLine) {
        window.dispatchEvent(new Event('cgstock:sync'))
      }
      toast.info('Operação recolocada na fila para nova tentativa de sincronização.')
    } catch {
      toast.error('Não foi possível recolocar a operação na fila.')
    }
  }

  const pendingCount = tasks.filter(t => t.status === 'PENDING' || t.status === 'ERROR').length
  const conflictCount = tasks.filter(t => t.status === 'CONFLICT').length

  return (
    <div className="min-h-screen bg-accent p-4 font-sans max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <h1 className="text-xl font-bold">Sincronização</h1>
      </div>

      <OfflinePrepareCard />

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
              ? "Você tem conexão. Pode sincronizar suas operações locais com o servidor."
              : "Sem internet. Suas operações estão sendo salvas localmente."}
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

      {conflictCount > 0 && <p role="alert" className="mb-4 rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">{conflictCount} operação(ões) com conflito. Nenhuma será reenviada automaticamente. Confira os detalhes abaixo e peça revisão ao responsável pelo estoque antes de tomar qualquer decisão.</p>}
      {unownedCount > 0 && <p role="alert" className="mb-4 rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">Há {unownedCount} operação(ões) antigas sem identificação de usuário neste dispositivo. Elas não serão enviadas automaticamente; solicite revisão antes de removê-las.</p>}
      <h2 className="text-muted-foreground font-semibold mb-4 ml-1">Fila de Sincronização</h2>
      
      {tasks.length === 0 ? (
        <div className="text-center p-8 bg-muted rounded-md text-muted-foreground border border-dashed">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Nenhuma operação na fila.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} className="bg-card p-4 rounded-md shadow-sm border border-border space-y-3">
              <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-sm">{({
                  SUBMIT_COLLECTION: 'Envio de Coleta',
                  CREATE_RECEIPT: 'Entrada de Materiais',
                  CONFIRM_RECEIPT: 'Confirmação de Recebimento',
                  CREATE_REQUEST: 'Nova Requisição',
                  CREATE_ADJUSTMENT: 'Ajuste de Estoque',
                  CREATE_TRANSFER: 'Transferência',
                  CREATE_RETURN: 'Devolução',
                  CREATE_QUICK_ISSUE: 'Entrega Rápida',
                  FULFILL_REQUEST: 'Atendimento de Requisição',
                  REQUEST_STATUS: 'Atualização de Requisição',
                  CREATE_INVENTORY: 'Novo Inventário'
                } as Record<string, string>)[task.operation] || task.operation}</p>
                <p className="text-xs text-muted-foreground">{new Date(task.createdAt).toLocaleString()}</p>
                {task.error && <p className="text-xs text-red-600 mt-1 break-words max-w-[220px]">{task.error}</p>}
              </div>
              <div>
                {task.status === 'SYNCED' && <Badge variant="success">Sincronizado</Badge>}
                {task.status === 'PENDING' && <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>}
                {task.status === 'ERROR' && <Badge variant="destructive" className="flex gap-1 items-center"><AlertCircle className="h-3 w-3"/> Erro ({task.attempts})</Badge>}
                {task.status === 'CONFLICT' && <Badge variant="outline" className="flex gap-1 items-center border-amber-600 text-amber-700"><AlertCircle className="h-3 w-3"/> Revisar</Badge>}
                {task.status === 'SYNCING' && <Badge variant="secondary" className="">Enviando</Badge>}
              </div>
              </div>
              {task.status === 'CONFLICT' && (
                <div className="space-y-2 border-t border-border pt-3 text-sm">
                  {task.operation === 'SUBMIT_COLLECTION' ? (
                    <>
                      <p>Inventário: {String(task.payload.inventoryId || '')} · Local: {String(task.payload.locationId || '')}</p>
                      <p>Itens nesta coleta: {Array.isArray(task.payload.items) ? task.payload.items.length : 0}</p>
                      <Link href={`/inventory/${encodeURIComponent(String(task.payload.inventoryId || ''))}`} className="inline-block font-semibold text-primary underline">Conferir inventário no servidor</Link>
                    </>
                  ) : task.operation === 'CREATE_REQUEST' ? (
                    <>
                      <p>Prioridade: {String(task.payload.priority || 'NORMAL')}</p>
                      <p>Itens nesta requisição: {Array.isArray(task.payload.items) ? task.payload.items.length : 0}</p>
                      <Link href="/requests" className="inline-block font-semibold text-primary underline">Conferir requisições no servidor</Link>
                    </>
                  ) : task.operation === 'CREATE_ADJUSTMENT' ? (
                    <>
                      <p>{task.payload.type === 'ADJUSTMENT_OUT' ? 'Saída' : 'Entrada'} de {String(task.payload.quantity ?? '')} unidade(s)</p>
                      <p>Motivo: {String(task.payload.reason || '—')}</p>
                      <Link href="/movements" className="inline-block font-semibold text-primary underline">Conferir movimentações no servidor</Link>
                    </>
                  ) : task.operation === 'CREATE_TRANSFER' ? (
                    <>
                      <p>Itens na transferência: {Array.isArray(task.payload.items) ? task.payload.items.length : 0}</p>
                      <Link href="/transfers" className="inline-block font-semibold text-primary underline">Conferir transferências no servidor</Link>
                    </>
                  ) : task.operation === 'CREATE_RETURN' ? (
                    <>
                      <p>Motivo: {String(task.payload.reason || '—')}</p>
                      <p>Itens na devolução: {Array.isArray(task.payload.items) ? task.payload.items.length : 0}</p>
                      <Link href="/returns" className="inline-block font-semibold text-primary underline">Conferir devoluções no servidor</Link>
                    </>
                  ) : task.operation === 'CREATE_QUICK_ISSUE' ? (
                    <>
                      <p>Itens na entrega: {Array.isArray(task.payload.items) ? task.payload.items.length : 0}</p>
                      <Link href="/quick-issue" className="inline-block font-semibold text-primary underline">Conferir entregas rápidas no servidor</Link>
                    </>
                  ) : task.operation === 'FULFILL_REQUEST' ? (
                    <>
                      <p>Itens entregues: {Array.isArray(task.payload.items) ? task.payload.items.length : 0}</p>
                      <Link href={`/requests/${encodeURIComponent(String(task.payload.requestId || ''))}`} className="inline-block font-semibold text-primary underline">Conferir requisição no servidor</Link>
                    </>
                  ) : task.operation === 'REQUEST_STATUS' ? (
                    <>
                      <p>Ação: {{ APPROVE: 'Aprovar', REJECT: 'Rejeitar', CANCEL: 'Cancelar', START_SEPARATION: 'Iniciar separação' }[String(task.payload.action)] || String(task.payload.action || '—')}</p>
                      <Link href={`/requests/${encodeURIComponent(String(task.payload.requestId || ''))}`} className="inline-block font-semibold text-primary underline">Conferir requisição no servidor</Link>
                    </>
                  ) : (
                    <>
                      <p>Documento: {String(task.payload.documentNumber || 'Sem número')}</p>
                      <p>Itens nesta entrada: {Array.isArray(task.payload.items) ? task.payload.items.length : 0}</p>
                      <Link href="/receipts" className="inline-block font-semibold text-primary underline">Conferir entradas no servidor</Link>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground">Compare com o registro no servidor e peça revisão ao responsável. A operação local não será aplicada automaticamente.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="default" onClick={() => void retryConflict(task)}>Tentar sincronizar novamente</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void discardConflict(task)}>Descartar após revisão</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
