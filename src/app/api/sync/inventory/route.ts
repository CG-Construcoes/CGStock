import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { assertWarehouseAccess } from "@/lib/dal"
import { checkSyncReplay, isSyncKey, isUniqueConflict, payloadHash } from "@/lib/sync-idempotency"

const MAX_NUMBER_ATTEMPTS = 5

export async function POST(req: NextRequest) {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  if (!session.roles?.includes("ADMIN") && !(await hasPermission("INVENTORY_CREATE"))) {
    return NextResponse.json({ error: "Sem permissão para criar inventários." }, { status: 403 })
  }

  try {
    const { payload, idempotencyKey, userId } = await req.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ error: "Operação pertence a outro usuário." }, { status: 403 })
    }
    if (
      !isSyncKey(idempotencyKey) ||
      !payload ||
      typeof payload.name !== "string" ||
      !payload.name.trim() ||
      typeof payload.warehouseId !== "string" ||
      !Array.isArray(payload.locationIds) ||
      !Array.isArray(payload.operatorIds)
    ) {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }

    const name = payload.name.trim().slice(0, 200)
    const warehouseId = payload.warehouseId
    const rawType = typeof payload.type === "string" ? payload.type : "PARTIAL"
    const inventoryType = ["PARTIAL", "FULL", "CYCLE_COUNT"].includes(rawType) ? rawType : "PARTIAL"
    const locationIds = [...new Set((payload.locationIds as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0))]
    const operatorIds = [...new Set((payload.operatorIds as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0))]

    if (locationIds.length === 0 || operatorIds.length === 0) {
      return NextResponse.json({ error: "Selecione locais e operadores válidos." }, { status: 400 })
    }

    try {
      await assertWarehouseAccess(warehouseId, session.userId)
    } catch {
      return NextResponse.json({ error: "Sem acesso a este almoxarifado." }, { status: 403 })
    }

    const validLocations = await db.warehouseLocation.count({ where: { id: { in: locationIds }, warehouseId } })
    if (validLocations !== locationIds.length) {
      return NextResponse.json({ error: "Localização inválida para este almoxarifado." }, { status: 400 })
    }

    const hash = payloadHash(payload)
    const replay = await checkSyncReplay(session.userId, "CREATE_INVENTORY", idempotencyKey, hash)
    if (replay === "replayed") {
      const existingOp = await db.offlineSyncOperation.findUnique({
        where: { userId_operation_idempotencyKey: { userId: session.userId, operation: "CREATE_INVENTORY", idempotencyKey } }
      })
      return NextResponse.json({ success: true, alreadyProcessed: true, inventoryId: existingOp?.resultId })
    }
    if (replay === "conflict") {
      return NextResponse.json({ error: "Esta operação foi alterada. Revise antes de sincronizar." }, { status: 409 })
    }

    const currentYear = new Date().getFullYear()
    const codePrefix = `INV-${currentYear}-`

    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
      const lastInventory = await db.inventory.findFirst({
        where: { code: { startsWith: codePrefix } },
        orderBy: { createdAt: "desc" },
        select: { code: true }
      })
      let nextNumber = 1
      if (lastInventory) {
        const parsed = parseInt(lastInventory.code.split("-")[2], 10)
        if (!isNaN(parsed)) nextNumber = parsed + 1
      }
      const code = `${codePrefix}${String(nextNumber + attempt).padStart(3, "0")}`

      try {
        const inventoryId = await db.$transaction(async (tx) => {
          const operation = await tx.offlineSyncOperation.create({
            data: {
              userId: session.userId,
              operation: "CREATE_INVENTORY",
              idempotencyKey,
              entityKey: idempotencyKey,
              payloadHash: hash,
            }
          })
          const inv = await tx.inventory.create({
            data: {
              code,
              name,
              warehouseId,
              type: inventoryType,
              createdById: session.userId,
              status: "IN_PROGRESS",
              startedAt: new Date(),
              locations: {
                create: locationIds.map((locId) => ({ locationId: locId, status: "PENDING" }))
              },
              operators: {
                create: operatorIds.map((opId) => ({ userId: opId }))
              }
            }
          })
          await tx.offlineSyncOperation.update({ where: { id: operation.id }, data: { resultId: inv.id } })
          await logAudit("INVENTORY_CREATED_OFFLINE", "Inventory", inv.id, { code, name }, session.userId, tx)
          return inv.id
        })

        return NextResponse.json({ success: true, inventoryId, code })
      } catch (error) {
        if (isUniqueConflict(error)) {
          const target = JSON.stringify((error as { meta?: { target?: unknown } }).meta?.target ?? "")
          if (target.includes("code")) continue
          const result = await checkSyncReplay(session.userId, "CREATE_INVENTORY", idempotencyKey, hash)
          if (result === "replayed") return NextResponse.json({ success: true, alreadyProcessed: true })
          return NextResponse.json({ error: "Inventário duplicado ou alterado. Revise antes de sincronizar." }, { status: 409 })
        }
        throw error
      }
    }

    return NextResponse.json({ error: "Não foi possível gerar o código do inventário. Tente novamente." }, { status: 409 })
  } catch (err) {
    console.error("Offline sync error (inventory):", err)
    return NextResponse.json({ error: "Erro interno ao processar o inventário." }, { status: 500 })
  }
}
