import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { Prisma } from "@prisma/client"

const MAX_SYNC_ITEMS = 5000

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 })
  }

  try {
    const { operation, payload } = await request.json()

    if (operation === 'SUBMIT_COLLECTION') {
      const { inventoryId, locationId, items } = payload ?? {}

      if (!inventoryId || !locationId || !Array.isArray(items)) {
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
        where: { id: inventoryId },
        include: {
          operators: { where: { userId: session.userId } },
          locations: { where: { locationId } }
        }
      })

      if (!inventory) {
        return NextResponse.json({ success: false, error: "Inventário não encontrado" }, { status: 404 })
      }
      if (!['IN_PROGRESS', 'COUNTING'].includes(inventory.status)) {
        return NextResponse.json({ success: false, error: "Inventário não está aberto para coleta" }, { status: 409 })
      }
      if (inventory.operators.length === 0 && !isAdmin) {
        return NextResponse.json({ success: false, error: "Você não está escalado como operador deste inventário" }, { status: 403 })
      }
      if (inventory.locations.length === 0) {
        return NextResponse.json({ success: false, error: "Localização não faz parte do inventário" }, { status: 400 })
      }

      const validItems = (items as { productId: unknown, quantity: unknown }[])
        .map(i => ({ productId: String(i.productId), quantity: Number(i.quantity) }))
        .filter(i => i.productId && i.quantity > 0)

      try {
        await db.$transaction(async (tx) => {
          // Verifica se já não foi submetido (idempotência básica)
          const existing = await tx.inventoryCollection.findFirst({
            where: { inventoryId, locationId, operatorId: session.userId }
          })

          if (existing) return

          await tx.inventoryCollection.create({
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
        })
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2025')
        ) {
          // Já submetido ou local já concluído — trata como idempotente
          return NextResponse.json({ success: true, message: "Já processado anteriormente" })
        }
        throw error
      }

      await logAudit("COLLECTION_SUBMITTED_OFFLINE", "InventoryCollection", `${inventoryId}_${locationId}`)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: "Operação desconhecida" }, { status: 400 })

  } catch (error) {
    console.error("Sync Error:", error)
    return NextResponse.json({ success: false, error: "Erro interno ao processar a sincronização." }, { status: 500 })
  }
}
