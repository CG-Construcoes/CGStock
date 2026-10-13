import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { assertWarehouseAccess } from "@/lib/dal"
import { checkSyncReplay, isSyncKey, isUniqueConflict, payloadHash } from "@/lib/sync-idempotency"

const ACTIONS = ['APPROVE', 'REJECT', 'CANCEL', 'START_SEPARATION'] as const
type RequestAction = typeof ACTIONS[number]

/**
 * Sincroniza transições de status de requisição feitas offline
 * (aprovar, rejeitar, cancelar, iniciar separação).
 * Estado divergente no servidor retorna 409 para revisão manual.
 */
export async function POST(req: NextRequest) {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const isAdmin = !!session.roles?.includes('ADMIN')

  try {
    const { payload, idempotencyKey, userId } = await req.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ error: "Operação pertence a outro usuário." }, { status: 403 })
    }
    if (!isSyncKey(idempotencyKey) || !payload || typeof payload.requestId !== 'string' || !ACTIONS.includes(payload.action)) {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }

    const requestId = payload.requestId as string
    const action = payload.action as RequestAction
    const reason = typeof payload.reason === 'string' ? payload.reason.slice(0, 1000) : null

    const request = await db.materialRequest.findUnique({ where: { id: requestId } })
    if (!request) return NextResponse.json({ error: "Requisição não encontrada. Revise manualmente." }, { status: 409 })

    const canApprove = isAdmin || await hasPermission('REQUEST_APPROVE')
    const canFulfill = isAdmin || await hasPermission('REQUEST_FULFILL')

    if ((action === 'APPROVE' || action === 'REJECT') && !canApprove) {
      return NextResponse.json({ error: "Sem permissão para aprovar/rejeitar requisições." }, { status: 403 })
    }
    if (action === 'START_SEPARATION' && !canFulfill) {
      return NextResponse.json({ error: "Sem permissão para separar requisições." }, { status: 403 })
    }
    if (action === 'CANCEL' && request.requesterId !== session.userId && !canApprove) {
      return NextResponse.json({ error: "Apenas o solicitante ou um aprovador pode cancelar." }, { status: 403 })
    }

    try {
      await assertWarehouseAccess(request.warehouseId, session.userId)
    } catch {
      return NextResponse.json({ error: "Sem acesso a este almoxarifado." }, { status: 403 })
    }

    const statusError =
      (action === 'APPROVE' || action === 'REJECT') && request.status !== 'PENDING_APPROVAL' ? "A requisição não está aguardando aprovação." :
      action === 'START_SEPARATION' && request.status !== 'APPROVED' ? "A requisição precisa estar aprovada para iniciar a separação." :
      action === 'CANCEL' && ['PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'REJECTED'].includes(request.status) ? "A requisição não pode mais ser cancelada." :
      null
    if (statusError) return NextResponse.json({ error: `${statusError} Revise manualmente.` }, { status: 409 })

    const hash = payloadHash(payload)
    const replay = await checkSyncReplay(session.userId, 'REQUEST_STATUS', idempotencyKey, hash)
    if (replay === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
    if (replay === 'conflict') return NextResponse.json({ error: "Esta operação foi alterada. Revise antes de sincronizar." }, { status: 409 })

    const auditAction = { APPROVE: 'REQUEST_APPROVED', REJECT: 'REQUEST_REJECTED', CANCEL: 'REQUEST_CANCELLED', START_SEPARATION: 'REQUEST_SEPARATION_STARTED' }[action]

    try {
      await db.$transaction(async tx => {
        const operation = await tx.offlineSyncOperation.create({
          data: { userId: session.userId, operation: 'REQUEST_STATUS', idempotencyKey, entityKey: idempotencyKey, payloadHash: hash }
        })
        if (action === 'APPROVE') {
          await tx.materialRequest.update({ where: { id: requestId }, data: { status: 'APPROVED', approvedById: session.userId, approvedAt: new Date() } })
          await tx.$executeRaw`
            UPDATE "MaterialRequestItem"
            SET "approvedQuantity" = "requestedQuantity", "updatedAt" = NOW()
            WHERE "requestId" = ${requestId}
          `
        } else if (action === 'REJECT') {
          await tx.materialRequest.update({ where: { id: requestId }, data: { status: 'REJECTED', notes: reason } })
        } else if (action === 'CANCEL') {
          await tx.materialRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED' } })
        } else {
          await tx.materialRequest.update({ where: { id: requestId }, data: { status: 'IN_SEPARATION' } })
        }
        await tx.offlineSyncOperation.update({ where: { id: operation.id }, data: { resultId: requestId } })
        await logAudit(`${auditAction}_OFFLINE`, "MaterialRequest", requestId, { action, reason }, session.userId, tx)
      })
      return NextResponse.json({ success: true, requestId })
    } catch (error) {
      if (isUniqueConflict(error)) {
        const result = await checkSyncReplay(session.userId, 'REQUEST_STATUS', idempotencyKey, hash)
        if (result === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
        return NextResponse.json({ error: "Operação duplicada ou alterada. Revise antes de sincronizar." }, { status: 409 })
      }
      throw error
    }
  } catch (err) {
    console.error("Offline sync error (request-status):", err)
    return NextResponse.json({ error: "Erro interno ao processar a operação." }, { status: 500 })
  }
}
