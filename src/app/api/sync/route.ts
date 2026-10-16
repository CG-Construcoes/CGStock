import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { Prisma } from "@prisma/client"
import { warehouseIdFilter } from "@/lib/dal"
import { checkSyncReplay, isSyncKey, isUniqueConflict, payloadHash, SyncConflict } from "@/lib/sync-idempotency"

const MAX_SYNC_ITEMS = 5000

export async function POST(request: Request) {
  const session = await getValidatedSession()
  if (!session) {
    return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 })
  }

  try {
    const { operation, payload, userId, idempotencyKey } = await request.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ success: false, error: "Operação pertence a outro usuário." }, { status: 403 })
    }

    if (operation === 'SUBMIT_COLLECTION') {
      const { inventoryId, locationId, items } = payload ?? {}

      if (!inventoryId || !locationId || !Array.isArray(items) || !isSyncKey(idempotencyKey)) {
        return NextResponse.json({ success: false, error: "Payload inválido" }, { status: 400 })
      }
      if (items.length === 0) {
        return NextResponse.json({ success: false, error: "Nenhum item coletado." }, { status: 400 })
      }
      if (items.length > MAX_SYNC_ITEMS) {
        return NextResponse.json({ success: false, error: "Payload excede o limite de itens" }, { status: 400 })
      }

      const isAdmin = session.roles?.includes('ADMIN')
      const canCount = isAdmin || await hasPermission('INVENTORY_COUNT')
      if (!canCount) {
        return NextResponse.json({ success: false, error: "Sem permissão para submeter coletas." }, { status: 403 })
      }

      const inventory = await db.inventory.findUnique({
        where: { id: inventoryId, ...await warehouseIdFilter(session.userId) },
        include: {
          operators: { where: { userId: session.userId } },
          locations: { where: { locationId } }
        }
      })

      if (!inventory) {
        return NextResponse.json({ success: false, error: "Inventário não encontrado" }, { status: 404 })
      }
      if (inventory.operators.length === 0 && !isAdmin) {
        return NextResponse.json({ success: false, error: "Você não está escalado como operador deste inventário" }, { status: 403 })
      }
      if (inventory.locations.length === 0) {
        return NextResponse.json({ success: false, error: "Localização não faz parte do inventário" }, { status: 400 })
      }

      const hash = payloadHash(payload)
      const replay = await checkSyncReplay(session.userId, operation, idempotencyKey, hash)
      if (replay === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
      if (replay === 'conflict') return NextResponse.json({ error: "Esta coleta foi alterada. Revise antes de sincronizar." }, { status: 409 })
      if (!['IN_PROGRESS', 'COUNTING'].includes(inventory.status)) {
        return NextResponse.json({ success: false, error: "Inventário não está aberto para coleta" }, { status: 409 })
      }
      const validItems = (items as { productId: unknown, quantity: unknown }[])
        .map(i => ({ productId: i && typeof i.productId === 'string' ? i.productId : '', quantity: Number(i?.quantity) }))
      if (validItems.some(i => !i.productId || !Number.isFinite(i.quantity) || i.quantity < 0) || new Set(validItems.map(i => i.productId)).size !== validItems.length) {
        return NextResponse.json({ error: "Itens de coleta inválidos." }, { status: 400 })
      }

      try {
        const created = await db.$transaction(async (tx) => {
          const record = await tx.offlineSyncOperation.create({
            data: { userId: session.userId, operation, idempotencyKey, entityKey: `${inventoryId}_${locationId}`, payloadHash: hash }
          })
          // Verifica se já não foi submetido (idempotência básica)
          const existing = await tx.inventoryCollection.findFirst({
            where: { inventoryId, locationId, operatorId: session.userId },
            include: { items: true }
          })

          if (existing) {
            const previous = existing.items.map(i => `${i.productId}:${i.quantity}`).sort()
            const current = validItems.map(i => `${i.productId}:${i.quantity}`).sort()
            if (JSON.stringify(previous) !== JSON.stringify(current)) throw new SyncConflict('Coleta anterior diferente. Revise com o responsável.')
            await tx.offlineSyncOperation.update({ where: { id: record.id }, data: { resultId: existing.id } })
            return false
          }

          const collection = await tx.inventoryCollection.create({
            data: {
              inventoryId,
              locationId,
              operatorId: session.userId,
              status: 'SUBMITTED',
              startedAt: new Date(),
              finishedAt: new Date(),
              items: {
                create: validItems
              }
            }
          })

          await tx.inventoryLocation.update({
            where: {
              inventoryId_locationId: { inventoryId, locationId }
            },
            data: {
              status: 'COMPLETED',
              finishedAt: new Date()
            }
          })
          await tx.offlineSyncOperation.update({ where: { id: record.id }, data: { resultId: collection.id } })
          return true
        })
        if (created) await logAudit("COLLECTION_SUBMITTED_OFFLINE", "InventoryCollection", `${inventoryId}_${locationId}`)
        return NextResponse.json({ success: true })
      } catch (error) {
        if (error instanceof SyncConflict) return NextResponse.json({ error: error.message }, { status: 409 })
        if (isUniqueConflict(error) || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')) {
          // Já submetido ou local já concluído — trata como idempotente
          const result = await checkSyncReplay(session.userId, operation, idempotencyKey, hash)
          if (result === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
          return NextResponse.json({ error: "Coleta já processada ou local concluído. Revise com o responsável." }, { status: 409 })
        }
        throw error
      }
    }

    return NextResponse.json({ success: false, error: "Operação desconhecida" }, { status: 400 })

  } catch (error) {
    console.error("Sync Error:", error)
    return NextResponse.json({ success: false, error: "Erro interno ao processar a sincronização." }, { status: 500 })
  }
}
