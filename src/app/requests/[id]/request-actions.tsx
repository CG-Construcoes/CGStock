"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Play } from "lucide-react"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { toast } from "sonner"

type StatusAction = 'APPROVE' | 'REJECT' | 'START_SEPARATION'

export function RequestActionButtons({
  requestId,
  status,
  userId,
  sessionExpiresAt,
  approveAction,
  rejectAction,
  separationAction
}: {
  requestId: string
  status: string
  userId: string
  sessionExpiresAt: string
  approveAction: () => Promise<void>
  rejectAction: () => Promise<void>
  separationAction: () => Promise<void>
}) {
  const [busy, setBusy] = useState<StatusAction | null>(null)

  const run = async (action: StatusAction, serverAction: () => Promise<void>, reason?: string) => {
    if (busy) return
    if (!navigator.onLine) {
      if (Date.now() >= new Date(sessionExpiresAt).getTime()) {
        toast.error('Sessão expirada. Conecte-se e entre novamente para atualizar a requisição.')
        return
      }
      setBusy(action)
      try {
        await queueOfflineOperation('REQUEST_STATUS', { requestId, action, reason }, userId)
        toast.success("Operação salva neste dispositivo. Será aplicada ao sincronizar.")
      } catch (err) {
        toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"))
      } finally {
        setBusy(null)
      }
      return
    }
    setBusy(action)
    try {
      await serverAction()
      toast.success("Requisição atualizada.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a requisição.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {status === 'PENDING_APPROVAL' && (
        <>
          <Button
            variant="destructive"
            className="flex items-center gap-2"
            disabled={busy !== null}
            onClick={() => void run('REJECT', rejectAction, "Rejeitado pelo gestor")}
          >
            <XCircle className="h-4 w-4" />
            Rejeitar
          </Button>
          <Button
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={busy !== null}
            onClick={() => void run('APPROVE', approveAction)}
          >
            <CheckCircle className="h-4 w-4" />
            Aprovar
          </Button>
        </>
      )}
      {status === 'APPROVED' && (
        <Button
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          disabled={busy !== null}
          onClick={() => void run('START_SEPARATION', separationAction)}
        >
          <Play className="h-4 w-4" />
          Iniciar Separação
        </Button>
      )}
    </>
  )
}
