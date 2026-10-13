"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Ban } from "lucide-react"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { toast } from "sonner"

export function CancelRequestButton({ requestId, cancelAction, userId, sessionExpiresAt }: { requestId: string, cancelAction: () => Promise<void>, userId: string, sessionExpiresAt: string }) {
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    if (busy || !confirm('Deseja realmente cancelar esta requisição?')) return
    if (!navigator.onLine) {
      if (Date.now() >= new Date(sessionExpiresAt).getTime()) {
        toast.error('Sessão expirada. Conecte-se e entre novamente para cancelar a requisição.')
        return
      }
      setBusy(true)
      try {
        await queueOfflineOperation('REQUEST_STATUS', { requestId, action: 'CANCEL' }, userId)
        toast.success("Cancelamento salvo neste dispositivo. Será aplicado ao sincronizar.")
      } catch (err) {
        toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"))
      } finally {
        setBusy(false)
      }
      return
    }
    setBusy(true)
    try {
      await cancelAction()
      toast.success("Requisição cancelada.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível cancelar a requisição.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button type="button" variant="outline" disabled={busy} onClick={() => void handleClick()} className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20">
      <Ban className="h-4 w-4" />
      Cancelar Requisição
    </Button>
  )
}
