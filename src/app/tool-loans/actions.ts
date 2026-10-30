"use server"

import { db } from "@/lib/db"
import { cookies } from "next/headers"
import { assertWarehouseAccess, warehouseScopeIds } from "@/lib/dal"
import { revalidatePath } from "next/cache"
import { createWithUniqueNumber } from "@/lib/sequential"
import { requireActionPermission } from "@/lib/action-guard"
import { hasAnyPermission } from "@/lib/permissions"
import { createStockMovement } from "@/lib/stock"
import { logAudit } from "@/lib/audit"
import { sendNotification } from "@/lib/notification"
import { ensureWarehouseWorksite, resolveEmployeeForOperatorWarehouse } from "@/lib/employee-warehouse"

export type OpenLoanItemDTO = {
  itemId: string
  loanId: string
  loanNumber: string
  loanedAt: string
  productId: string
  productCode: string
  productName: string
  unitCode: string
  locationId: string
  locationCode: string
  quantityLoaned: number
  quantityReturned: number
  quantityPending: number
  status: string
  notes: string | null
}

export type OpenEmployeeLoanSummary = {
  employee: {
    id: string
    name: string
    employeeCode: string | null
    document: string | null
  }
  warehouseName: string
  warehouseId: string
  worksiteId: string
  worksiteName: string
  totalLoaned: number
  totalReturned: number
  totalPending: number
  hasPartialDiscrepancy: boolean
  oldestLoanedAt: string
  items: OpenLoanItemDTO[]
}

async function requireLoanPermission() {
  const allowed = await hasAnyPermission("STOCK_EXIT", "STOCK_ENTRY")
  if (!allowed) {
    throw new Error("Não autorizado.")
  }
  try {
    return await requireActionPermission("STOCK_EXIT")
  } catch {
    return await requireActionPermission("STOCK_ENTRY")
  }
}

export async function getEmployeeOpenLoanItems(employeeId: string, warehouseId: string): Promise<OpenLoanItemDTO[]> {
  const items = await db.toolLoanItem.findMany({
    where: {
      status: { in: ["OPEN", "PARTIAL"] },
      loan: {
        recipientId: employeeId,
        warehouseId,
        status: { in: ["OPEN", "PARTIAL"] },
      },
    },
    include: {
      loan: { select: { id: true, loanNumber: true, loanedAt: true } },
      product: { include: { unit: true } },
      location: { select: { id: true, code: true } },
    },
    orderBy: [{ loan: { loanedAt: "asc" } }, { createdAt: "asc" }],
  })

  return items
    .map((it) => ({
      itemId: it.id,
      loanId: it.loan.id,
      loanNumber: it.loan.loanNumber,
      loanedAt: it.loan.loanedAt.toISOString(),
      productId: it.productId,
      productCode: it.product.code,
      productName: it.product.name,
      unitCode: it.product.unit.code,
      locationId: it.locationId,
      locationCode: it.location.code,
      quantityLoaned: it.quantityLoaned,
      quantityReturned: it.quantityReturned,
      quantityPending: Math.max(0, it.quantityLoaned - it.quantityReturned),
      status: it.status,
      notes: it.notes,
    }))
    .filter((it) => it.quantityPending > 0)
}

export async function verifyEmployeeForToolLoan(
  qrToken: string,
  options?: { confirmTransfer?: boolean; explicitWarehouseId?: string }
) {
  let session
  try {
    session = await requireLoanPermission()
  } catch {
    return { error: "Não autorizado." }
  }

  const resolved = await resolveEmployeeForOperatorWarehouse(qrToken, session.userId, options)
  if (resolved.success !== true) {
    if (resolved.requiresTransfer) {
      return resolved
    }
    return { error: resolved.error ?? "Falha ao validar funcionário." }
  }

  const openItems = await getEmployeeOpenLoanItems(resolved.employee.id, resolved.warehouse.id)

  return {
    success: true as const,
    autoLinkedFirstTime: resolved.autoLinkedFirstTime,
    transferredFromWarehouseName: resolved.transferredFromWarehouseName,
    employee: resolved.employee,
    worksite: resolved.worksite,
    warehouse: resolved.warehouse,
    openItems,
  }
}

export async function getProductStockForToolLoan(worksiteId: string, warehouseId: string, productCode: string) {
  let session
  try {
    session = await requireLoanPermission()
  } catch {
    return { error: "Não autorizado." }
  }

  const code = productCode.trim()
  if (!code) return { error: "Informe ou escaneie o código do produto." }

  const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, status: "ACTIVE" } })
  if (!warehouse) return { error: "Almoxarifado inválido ou inativo." }
  try {
    await assertWarehouseAccess(warehouseId, session.userId)
  } catch {
    return { error: "Você não tem acesso a este almoxarifado." }
  }

  const product =
    (await db.product.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { code: { equals: code, mode: "insensitive" } },
          { barcode: { equals: code, mode: "insensitive" } },
          { id: code },
        ],
      },
      include: { unit: true },
    })) ??
    (await db.product.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { code: { contains: code, mode: "insensitive" } },
          { barcode: { contains: code, mode: "insensitive" } },
          { name: { contains: code, mode: "insensitive" } },
        ],
      },
      include: { unit: true },
      orderBy: { code: "asc" },
    }))

  if (!product) return { error: "Produto não encontrado no catálogo." }

  const stocks = await db.stock.findMany({
    where: {
      productId: product.id,
      warehouseId,
    },
    include: {
      location: true,
    },
  })

  const availableStocks = stocks.filter((s) => Number(s.quantity) > 0)
  const totalAvailable = availableStocks.reduce((sum, s) => sum + Number(s.quantity), 0)

  return {
    success: true,
    product: {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit.code,
    },
    totalAvailable,
    locations: availableStocks
      .map((s) => ({
        locationId: s.locationId,
        locationCode: s.location.code,
        quantity: Number(s.quantity),
      }))
      .sort((a, b) => Number(b.quantity) - Number(a.quantity)),
  }
}

export async function confirmToolLoan(payload: {
  employeeId: string
  worksiteId: string
  warehouseId: string
  notes?: string
  items: {
    productId: string
    requestedQuantity: number
  }[]
}) {
  let session
  try {
    session = await requireLoanPermission()
  } catch {
    return { error: "Não autorizado." }
  }

  const warehouse = await db.warehouse.findFirst({
    where: { id: payload.warehouseId, status: "ACTIVE" },
    select: { id: true, code: true, name: true, worksiteId: true },
  })
  if (!warehouse) return { error: "Almoxarifado inválido ou inativo." }
  try {
    await assertWarehouseAccess(payload.warehouseId, session.userId)
  } catch {
    return { error: "Você não tem acesso a este almoxarifado." }
  }

  const employee = await db.user.findFirst({
    where: { id: payload.employeeId, status: "ACTIVE", qrStatus: "ACTIVE" },
  })
  if (!employee) return { error: "Funcionário não encontrado ou inativo." }

  const resolvedWorksite = await ensureWarehouseWorksite({
    id: warehouse.id,
    code: warehouse.code || "ALM",
    name: warehouse.name || "Almoxarifado",
    worksiteId: warehouse.worksiteId ?? payload.worksiteId ?? null,
  })
  const effectiveWorksiteId = resolvedWorksite.id

  const validItems = (payload.items || []).filter((i) => Math.floor(Number(i.requestedQuantity)) > 0)
  if (validItems.length === 0) {
    return { error: "Adicione pelo menos um produto com quantidade maior que zero." }
  }

  try {
    const loanResult = await createWithUniqueNumber(
      async (attempt) => {
        const count = await db.toolLoan.count()
        return `CAU-${String(count + 1 + attempt).padStart(6, "0")}`
      },
      (loanNumber) =>
        db.$transaction(async (tx) => {
          const loan = await tx.toolLoan.create({
            data: {
              loanNumber,
              operatorId: session.userId,
              recipientId: payload.employeeId,
              worksiteId: effectiveWorksiteId,
              warehouseId: payload.warehouseId,
              status: "OPEN",
              notes: payload.notes?.trim() || null,
            },
          })

          for (const item of validItems) {
            const qtyWanted = Math.floor(Number(item.requestedQuantity))
            const stocks = await tx.stock.findMany({
              where: {
                productId: item.productId,
                warehouseId: payload.warehouseId,
                quantity: { gt: 0 },
              },
              orderBy: { quantity: "desc" },
            })

            const totalAvailable = stocks.reduce((sum, s) => sum + Number(s.quantity), 0)
            if (qtyWanted > totalAvailable) {
              const prod = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true } })
              throw new Error(
                `Estoque insuficiente para "${prod?.name ?? item.productId}" (disponível: ${totalAvailable}, solicitado: ${qtyWanted}).`
              )
            }

            let remaining = qtyWanted
            for (const stock of stocks) {
              if (remaining <= 0) break
              const qtyToTake = Math.min(Math.floor(Number(stock.quantity)), remaining)
              if (qtyToTake <= 0) continue

              await tx.toolLoanItem.create({
                data: {
                  loanId: loan.id,
                  productId: item.productId,
                  locationId: stock.locationId,
                  quantityLoaned: qtyToTake,
                  quantityReturned: 0,
                  status: "OPEN",
                },
              })

              const { movement } = await createStockMovement(
                {
                  productId: item.productId,
                  warehouseId: stock.warehouseId,
                  locationId: stock.locationId,
                  type: "EXIT",
                  quantity: qtyToTake,
                  referenceType: "TOOL_LOAN",
                  referenceId: loan.id,
                  documentNumber: loanNumber,
                  reason: `Empréstimo diário (cautela) para ${employee.name}`,
                  performedById: session.userId,
                },
                tx
              )

              await tx.stockMovement.update({
                where: { id: movement.id },
                data: {
                  recipientUserId: payload.employeeId,
                  worksiteId: effectiveWorksiteId,
                },
              })

              remaining -= qtyToTake
            }

            if (remaining > 0) {
              throw new Error("Falha ao alocar saldo nas localizações do almoxarifado.")
            }
          }

          await logAudit(
            "TOOL_LOAN_CREATED",
            "ToolLoan",
            loan.id,
            { loanNumber, recipientId: payload.employeeId, itemsCount: validItems.length },
            session.userId,
            tx
          )

          return loan
        })
    )

    const openItems = await getEmployeeOpenLoanItems(payload.employeeId, payload.warehouseId)
    revalidatePath("/tool-loans")
    revalidatePath("/movements")
    revalidatePath("/stock")

    return {
      success: true,
      loanNumber: loanResult.loanNumber,
      openItems,
    }
  } catch (error) {
    console.error("confirmToolLoan error:", error)
    return { error: error instanceof Error ? error.message : "Erro ao registrar empréstimo." }
  }
}

export async function returnToolLoanItem(payload: {
  itemId: string
  quantityReturning: number
  notes?: string
}) {
  let session
  try {
    session = await requireLoanPermission()
  } catch {
    return { error: "Não autorizado." }
  }

  const qtyReturning = Math.floor(Number(payload.quantityReturning))
  if (!Number.isFinite(qtyReturning) || qtyReturning <= 0) {
    return { error: "Informe uma quantidade de devolução maior que zero." }
  }

  const loanItem = await db.toolLoanItem.findUnique({
    where: { id: payload.itemId },
    include: {
      loan: {
        include: {
          recipient: { select: { id: true, name: true, employeeCode: true } },
          warehouse: { select: { id: true, name: true } },
        },
      },
      product: { include: { unit: true } },
      location: { select: { id: true, code: true } },
    },
  })

  if (!loanItem) return { error: "Item de empréstimo não encontrado." }

  try {
    await assertWarehouseAccess(loanItem.loan.warehouseId, session.userId)
  } catch {
    return { error: "Você não tem acesso a este almoxarifado." }
  }

  const pendingBefore = loanItem.quantityLoaned - loanItem.quantityReturned
  if (pendingBefore <= 0) {
    return { error: "Este item já foi totalmente devolvido." }
  }

  if (qtyReturning > pendingBefore) {
    return {
      error: `Quantidade maior que o pendente! Você emprestou ${loanItem.quantityLoaned} (${pendingBefore} pendente) e tentou devolver ${qtyReturning}.`,
    }
  }

  const newTotalReturned = loanItem.quantityReturned + qtyReturning
  const missingAfter = loanItem.quantityLoaned - newTotalReturned
  const newItemStatus = missingAfter === 0 ? "RETURNED" : "PARTIAL"

  try {
    await db.$transaction(async (tx) => {
      const noteText =
        missingAfter > 0
          ? [
              payload.notes?.trim(),
              `Entregou ${newTotalReturned} de ${loanItem.quantityLoaned} (faltam ${missingAfter})`,
            ]
              .filter(Boolean)
              .join(" — ")
          : payload.notes?.trim() || loanItem.notes

      await tx.toolLoanItem.update({
        where: { id: loanItem.id },
        data: {
          quantityReturned: newTotalReturned,
          status: newItemStatus,
          returnedAt: new Date(),
          returnedById: session.userId,
          notes: noteText || null,
        },
      })

      const { movement } = await createStockMovement(
        {
          productId: loanItem.productId,
          warehouseId: loanItem.loan.warehouseId,
          locationId: loanItem.locationId,
          type: "RETURN",
          quantity: qtyReturning,
          referenceType: "TOOL_LOAN_RETURN",
          referenceId: loanItem.loan.id,
          documentNumber: loanItem.loan.loanNumber,
          reason:
            missingAfter > 0
              ? `Devolução parcial de cautela (${newTotalReturned}/${loanItem.quantityLoaned}) — ${loanItem.loan.recipient.name}`
              : `Devolução de cautela (${newTotalReturned}/${loanItem.quantityLoaned}) — ${loanItem.loan.recipient.name}`,
          notes: noteText || null,
          performedById: session.userId,
        },
        tx
      )

      await tx.stockMovement.update({
        where: { id: movement.id },
        data: {
          recipientUserId: loanItem.loan.recipientId,
          worksiteId: loanItem.loan.worksiteId,
        },
      })

      // Recalcula status geral da cautela
      const siblingItems = await tx.toolLoanItem.findMany({
        where: { loanId: loanItem.loanId },
        select: { quantityLoaned: true, quantityReturned: true },
      })
      const allReturned = siblingItems.every((i) => i.quantityReturned >= i.quantityLoaned)
      const anyReturned = siblingItems.some((i) => i.quantityReturned > 0)
      const loanStatus = allReturned ? "RETURNED" : anyReturned ? "PARTIAL" : "OPEN"

      await tx.toolLoan.update({
        where: { id: loanItem.loanId },
        data: {
          status: loanStatus,
          returnedAt: allReturned ? new Date() : null,
        },
      })

      await logAudit(
        missingAfter > 0 ? "TOOL_LOAN_PARTIAL_RETURN" : "TOOL_LOAN_RETURNED",
        "ToolLoan",
        loanItem.loanId,
        {
          loanNumber: loanItem.loan.loanNumber,
          recipientName: loanItem.loan.recipient.name,
          productCode: loanItem.product.code,
          productName: loanItem.product.name,
          quantityLoaned: loanItem.quantityLoaned,
          quantityReturnedNow: qtyReturning,
          totalReturned: newTotalReturned,
          missing: missingAfter,
        },
        session.userId,
        tx
      )
    })

    if (missingAfter > 0) {
      const alertTitle = `Divergência na cautela ${loanItem.loan.loanNumber}`
      const alertMessage = `${loanItem.loan.recipient.name} entregou ${newTotalReturned} ${loanItem.product.unit.code} de "${loanItem.product.name}", mas recebeu ${loanItem.quantityLoaned} ${loanItem.product.unit.code}. Faltam ${missingAfter} ${loanItem.product.unit.code}!`
      await sendNotification(session.userId, alertTitle, alertMessage, "WARNING")
    }

    const openItems = await getEmployeeOpenLoanItems(loanItem.loan.recipientId, loanItem.loan.warehouseId)
    revalidatePath("/tool-loans")
    revalidatePath("/movements")
    revalidatePath("/stock")

    return {
      success: true,
      openItems,
      returnedProduct: {
        code: loanItem.product.code,
        name: loanItem.product.name,
        unit: loanItem.product.unit.code,
      },
      discrepancy:
        missingAfter > 0
          ? {
              employeeName: loanItem.loan.recipient.name,
              productName: loanItem.product.name,
              unitCode: loanItem.product.unit.code,
              loaned: loanItem.quantityLoaned,
              returnedNow: qtyReturning,
              totalReturned: newTotalReturned,
              missing: missingAfter,
              message: `Ele entregou ${newTotalReturned}, mas você emprestou ${loanItem.quantityLoaned} para ele! Faltam ${missingAfter} ${loanItem.product.unit.code}.`,
            }
          : null,
    }
  } catch (error) {
    console.error("returnToolLoanItem error:", error)
    return { error: error instanceof Error ? error.message : "Erro ao registrar devolução." }
  }
}

export async function listOpenToolLoans(): Promise<{
  summaries: OpenEmployeeLoanSummary[]
  activeWarehouseName: string | null
}> {
  let session
  try {
    session = await requireLoanPermission()
  } catch {
    return { summaries: [], activeWarehouseName: null }
  }

  const scope = await warehouseScopeIds(session.userId)
  const selectedWhId = (await cookies()).get("cgstock_active_warehouse")?.value || ""

  let activeWarehouseName: string | null = null
  if (selectedWhId) {
    const wh = await db.warehouse.findFirst({
      where: { id: selectedWhId, ...(scope ? { id: { in: scope } } : {}) },
      select: { name: true },
    })
    activeWarehouseName = wh?.name ?? null
  }

  const warehouseFilter = selectedWhId
    ? { warehouseId: selectedWhId }
    : scope !== null
    ? { warehouseId: { in: scope } }
    : {}

  const openItems = await db.toolLoanItem.findMany({
    where: {
      status: { in: ["OPEN", "PARTIAL"] },
      loan: {
        status: { in: ["OPEN", "PARTIAL"] },
        ...warehouseFilter,
      },
    },
    include: {
      loan: {
        include: {
          recipient: { select: { id: true, name: true, employeeCode: true, document: true } },
          warehouse: { select: { id: true, name: true } },
          worksite: { select: { id: true, name: true } },
        },
      },
      product: { include: { unit: true } },
      location: { select: { id: true, code: true } },
    },
    orderBy: [{ loan: { loanedAt: "asc" } }, { createdAt: "asc" }],
  })

  const byKey = new Map<string, OpenEmployeeLoanSummary>()

  for (const it of openItems) {
    const pending = Math.max(0, it.quantityLoaned - it.quantityReturned)
    if (pending <= 0) continue

    const key = `${it.loan.recipientId}_${it.loan.warehouseId}`
    let group = byKey.get(key)
    if (!group) {
      group = {
        employee: {
          id: it.loan.recipient.id,
          name: it.loan.recipient.name,
          employeeCode: it.loan.recipient.employeeCode,
          document: it.loan.recipient.document,
        },
        warehouseId: it.loan.warehouse.id,
        warehouseName: it.loan.warehouse.name,
        worksiteId: it.loan.worksite.id,
        worksiteName: it.loan.worksite.name,
        totalLoaned: 0,
        totalReturned: 0,
        totalPending: 0,
        hasPartialDiscrepancy: false,
        oldestLoanedAt: it.loan.loanedAt.toISOString(),
        items: [],
      }
      byKey.set(key, group)
    }

    group.totalLoaned += it.quantityLoaned
    group.totalReturned += it.quantityReturned
    group.totalPending += pending
    if (it.quantityReturned > 0 && pending > 0) {
      group.hasPartialDiscrepancy = true
    }

    group.items.push({
      itemId: it.id,
      loanId: it.loan.id,
      loanNumber: it.loan.loanNumber,
      loanedAt: it.loan.loanedAt.toISOString(),
      productId: it.productId,
      productCode: it.product.code,
      productName: it.product.name,
      unitCode: it.product.unit.code,
      locationId: it.locationId,
      locationCode: it.location.code,
      quantityLoaned: it.quantityLoaned,
      quantityReturned: it.quantityReturned,
      quantityPending: pending,
      status: it.status,
      notes: it.notes,
    })
  }

  return {
    summaries: Array.from(byKey.values()),
    activeWarehouseName,
  }
}
