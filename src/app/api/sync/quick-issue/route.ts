import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { assertWarehouseAccess, warehouseScopeIds } from "@/lib/dal"
import { createStockMovement } from "@/lib/stock"
import { checkSyncReplay, isSyncKey, isUniqueConflict, payloadHash } from "@/lib/sync-idempotency"

const MAX_ITEMS = 200
const MAX_NUMBER_ATTEMPTS = 5

/**
 * Sincroniza uma entrega rápida registrada offline.
 * O token QR do funcionário é resolvido e validado no servidor no momento
 * da sincronização — o aparelho não armazena o cadastro de tokens.
 */
export async function POST(req: NextRequest) {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  if (!session.roles?.includes('ADMIN') && !(await hasPermission('STOCK_EXIT'))) {
    return NextResponse.json({ error: "Sem permissão para entrega rápida." }, { status: 403 })
  }

  try {
    const { payload, idempotencyKey, userId } = await req.json()
    if (userId && userId !== session.userId) {
      return NextResponse.json({ error: "Operação pertence a outro usuário." }, { status: 403 })
    }
    if (!isSyncKey(idempotencyKey) || !payload || typeof payload.qrToken !== 'string' || !Array.isArray(payload.items)) {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 })
    }

    const qrToken = payload.qrToken.trim()
    const cleanDigits = qrToken.replace(/\D/g, "")
    const withoutEmpPrefix = qrToken.replace(/^EMP-/i, "")
    const rawItems = payload.items as { productCode?: unknown; productId?: unknown; quantity?: unknown }[]
    if (!rawItems.length || rawItems.length > MAX_ITEMS) {
      return NextResponse.json({ error: "Itens da entrega inválidos." }, { status: 400 })
    }
    const items = rawItems.map(i => ({
      productCode: typeof i?.productCode === 'string' ? i.productCode.trim() : '',
      productId: typeof i?.productId === 'string' ? i.productId.trim() : '',
      quantity: Number(i?.quantity)
    }))
    if (items.some(i => (!i.productCode && !i.productId) || !Number.isFinite(i.quantity) || i.quantity <= 0)) {
      return NextResponse.json({ error: "Itens da entrega inválidos." }, { status: 400 })
    }

    // Resolver o funcionário pelo QR, matrícula, CPF, e-mail ou ID (mesmas regras do fluxo online)
    const userRepo = db.user as unknown as {
      findFirst?: typeof db.user.findFirst
      findUnique: typeof db.user.findUnique
    }
    const employee = userRepo.findFirst
      ? await userRepo.findFirst({
          where: {
            OR: [
              ...(typeof payload.employeeId === 'string' && payload.employeeId ? [{ id: payload.employeeId }] : []),
              { qrToken },
              { qrToken: `EMP-${qrToken}` },
              { employeeCode: qrToken },
              { employeeCode: withoutEmpPrefix },
              { email: qrToken },
              { id: qrToken },
              ...(cleanDigits.length >= 8 ? [{ document: cleanDigits }, { document: qrToken }] : []),
            ]
          },
          include: { worksiteAccesses: { include: { worksite: true } } }
        })
      : await userRepo.findUnique({
          where: { qrToken },
          include: { worksiteAccesses: { include: { worksite: true } } }
        })

    if (!employee || employee.status !== 'ACTIVE' || (employee.qrToken === qrToken && employee.qrStatus !== 'ACTIVE') || employee.qrStatus === 'REVOKED') {
      return NextResponse.json({ error: "QR do funcionário não pôde ser validado. Revise manualmente." }, { status: 409 })
    }

    let worksite: { id: string; status: string } | null = employee.worksiteAccesses[0]?.worksite ?? null
    if (!worksite && (db as unknown as { worksite?: typeof db.worksite }).worksite?.findFirst) {
      worksite = await db.worksite.findFirst({
        where: {
          status: 'ACTIVE',
          ...(typeof payload.worksiteId === 'string' && payload.worksiteId ? { id: payload.worksiteId } : {})
        }
      })
    }
    if (!worksite || worksite.status !== 'ACTIVE') {
      return NextResponse.json({ error: "Obra do funcionário está inativa. Revise manualmente." }, { status: 409 })
    }
    const activeWorksite = worksite

    const scope = await warehouseScopeIds(session.userId)
    const requestedWarehouseId = typeof payload.warehouseId === 'string' && payload.warehouseId ? payload.warehouseId : undefined
    let warehouse = await db.warehouse.findFirst({
      where: {
        ...(requestedWarehouseId ? { id: requestedWarehouseId } : { worksiteId: activeWorksite.id }),
        status: 'ACTIVE',
        id: { in: scope ?? undefined }
      }
    })
    if (!warehouse && requestedWarehouseId) {
      warehouse = await db.warehouse.findFirst({
        where: { worksiteId: activeWorksite.id, status: 'ACTIVE', id: { in: scope ?? undefined } }
      })
    }
    if (!warehouse) {
      return NextResponse.json({ error: "Nenhum almoxarifado acessível para esta obra. Revise manualmente." }, { status: 409 })
    }
    try {
      await assertWarehouseAccess(warehouse.id, session.userId)
    } catch {
      return NextResponse.json({ error: "Sem acesso a este almoxarifado." }, { status: 403 })
    }

    // Resolver produtos pelo código bipado (exato, código de barras ou ID)
    const codes = [...new Set(items.map(i => i.productCode).filter(Boolean))]
    const ids = [...new Set(items.map(i => i.productId).filter(Boolean))]
    const products = await db.product.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          ...(codes.length ? [{ code: { in: codes } }, { barcode: { in: codes } }] : []),
          ...(ids.length ? [{ id: { in: ids } }] : []),
        ]
      },
      select: { id: true, code: true, barcode: true }
    })
    const byCode = new Map<string, string>()
    for (const p of products) {
      byCode.set(p.id, p.id)
      byCode.set(p.code, p.id)
      byCode.set(p.code.toLowerCase(), p.id)
      if (p.barcode) {
        byCode.set(p.barcode, p.id)
        byCode.set(p.barcode.toLowerCase(), p.id)
      }
    }
    if (items.some(i => !(byCode.get(i.productId) || byCode.get(i.productCode) || byCode.get(i.productCode.toLowerCase())))) {
      return NextResponse.json({ error: "Um ou mais produtos não foram encontrados. Revise manualmente." }, { status: 409 })
    }

    const hash = payloadHash(payload)
    const replay = await checkSyncReplay(session.userId, 'CREATE_QUICK_ISSUE', idempotencyKey, hash)
    if (replay === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
    if (replay === 'conflict') return NextResponse.json({ error: "Esta operação foi alterada. Revise antes de sincronizar." }, { status: 409 })

    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
      const issueCount = await db.quickIssue.count()
      const issueNumber = `ENT-${String(issueCount + 1 + attempt).padStart(6, '0')}`
      try {
        const issueId = await db.$transaction(async tx => {
          const operation = await tx.offlineSyncOperation.create({
            data: { userId: session.userId, operation: 'CREATE_QUICK_ISSUE', idempotencyKey, entityKey: idempotencyKey, payloadHash: hash }
          })
          const issue = await tx.quickIssue.create({
            data: {
              issueNumber,
              operatorId: session.userId,
              recipientId: employee.id,
              worksiteId: activeWorksite.id,
              warehouseId: warehouse.id,
              status: 'COMPLETED',
              completedAt: new Date()
            }
          })
          for (const item of items) {
            const productId = (byCode.get(item.productId) || byCode.get(item.productCode) || byCode.get(item.productCode.toLowerCase()))!
            const stocks = await tx.stock.findMany({
              where: { productId, warehouseId: warehouse.id, quantity: { gt: 0 } },
              orderBy: { quantity: 'desc' }
            })
            let remaining = item.quantity
            const total = stocks.reduce((sum, s) => sum + Number(s.quantity), 0)
            if (remaining > total) {
              throw new Error(`INSUFFICIENT_STOCK:${item.productCode}`)
            }
            for (const stock of stocks) {
              if (remaining <= 0) break
              const qtyToTake = Math.min(Number(stock.quantity), remaining)
              await tx.quickIssueItem.create({
                data: { issueId: issue.id, productId, locationId: stock.locationId, quantity: qtyToTake }
              })
              const { movement } = await createStockMovement({
                productId,
                warehouseId: stock.warehouseId,
                locationId: stock.locationId,
                type: 'EXIT',
                quantity: qtyToTake,
                referenceType: 'QUICK_ISSUE',
                referenceId: issue.id,
                documentNumber: issueNumber,
                reason: 'Entrega rápida (offline)',
                performedById: session.userId
              }, tx)
              await tx.stockMovement.update({
                where: { id: movement.id },
                data: { recipientUserId: employee.id, worksiteId: activeWorksite.id }
              })
              remaining -= qtyToTake
            }
          }
          await tx.offlineSyncOperation.update({ where: { id: operation.id }, data: { resultId: issue.id } })
          await logAudit("QUICK_ISSUE_CREATED_OFFLINE", "QuickIssue", issue.id, { issueNumber, recipientId: employee.id }, session.userId, tx)
          return issue.id
        })
        return NextResponse.json({ success: true, issueId, issueNumber })
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('INSUFFICIENT_STOCK:')) {
          return NextResponse.json({ error: "Estoque insuficiente para um ou mais itens. Revise manualmente." }, { status: 409 })
        }
        if (isUniqueConflict(error)) {
          const target = JSON.stringify((error as { meta?: { target?: unknown } }).meta?.target ?? '')
          if (target.includes('issueNumber')) continue
          const result = await checkSyncReplay(session.userId, 'CREATE_QUICK_ISSUE', idempotencyKey, hash)
          if (result === 'replayed') return NextResponse.json({ success: true, alreadyProcessed: true })
          return NextResponse.json({ error: "Entrega duplicada ou alterada. Revise antes de sincronizar." }, { status: 409 })
        }
        throw error
      }
    }
    return NextResponse.json({ error: "Não foi possível gerar o número da entrega. Tente novamente." }, { status: 409 })
  } catch (err) {
    console.error("Offline sync error (quick-issue):", err)
    return NextResponse.json({ error: "Erro interno ao processar a entrega rápida." }, { status: 500 })
  }
}
