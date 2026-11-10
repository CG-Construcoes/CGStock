"use server"

import { db } from "@/lib/db"
import { cookies } from "next/headers"
import { assertWarehouseAccess, getAccessibleWarehouses, warehouseScopeIds } from "@/lib/dal"
import { revalidatePath } from "next/cache"
import { createWithUniqueNumber } from "@/lib/sequential"
import { requireActionPermission } from "@/lib/action-guard"
import { hasAnyPermission } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { sendNotification } from "@/lib/notification"
import { ensureWarehouseWorksite, resolveEmployeeForOperatorWarehouse } from "@/lib/employee-warehouse"

export type ToolTrackingType = "ASSET" | "QUANTITY"

export type ToolAssetDTO = {
  id: string
  warehouseId: string
  warehouseName: string
  warehouseCode: string
  code: string
  qrToken: string
  name: string
  category: string | null
  brand: string | null
  serialNumber: string | null
  trackingType: ToolTrackingType
  totalQuantity: number
  loanedQuantity: number
  availableQuantity: number
  unit: string
  condition: string
  status: string
  notes: string | null
  currentHolders: {
    itemId: string
    loanNumber: string
    employeeId: string
    employeeName: string
    employeeCode: string | null
    quantityPending: number
    loanedAt: string
  }[]
}

export type OpenLoanItemDTO = {
  itemId: string
  loanId: string
  loanNumber: string
  loanedAt: string
  toolAssetId: string | null
  toolCode: string
  toolQrToken: string | null
  toolName: string
  toolCategory: string | null
  toolBrand: string | null
  trackingType: ToolTrackingType
  unitCode: string
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

function mapLoanItemToDTO(it: {
  id: string
  loan: { id: string; loanNumber: string; loanedAt: Date }
  toolAssetId: string | null
  toolAsset: {
    id: string
    code: string
    qrToken: string
    name: string
    category: string | null
    brand: string | null
    trackingType: string
    unit: string
  } | null
  product: { code: string; name: string; unit: { code: string } } | null
  quantityLoaned: number
  quantityReturned: number
  status: string
  notes: string | null
}): OpenLoanItemDTO {
  const asset = it.toolAsset
  const prod = it.product
  return {
    itemId: it.id,
    loanId: it.loan.id,
    loanNumber: it.loan.loanNumber,
    loanedAt: it.loan.loanedAt.toISOString(),
    toolAssetId: it.toolAssetId,
    toolCode: asset?.code ?? prod?.code ?? "SEM-COD",
    toolQrToken: asset?.qrToken ?? null,
    toolName: asset?.name ?? prod?.name ?? "Ferramenta",
    toolCategory: asset?.category ?? null,
    toolBrand: asset?.brand ?? null,
    trackingType: asset?.trackingType === "QUANTITY" ? "QUANTITY" : "ASSET",
    unitCode: asset?.unit ?? prod?.unit.code ?? "UN",
    quantityLoaned: it.quantityLoaned,
    quantityReturned: it.quantityReturned,
    quantityPending: Math.max(0, it.quantityLoaned - it.quantityReturned),
    status: it.status,
    notes: it.notes,
  }
}

export async function getEmployeeOpenLoanItems(employeeId: string, warehouseId?: string): Promise<OpenLoanItemDTO[]> {
  const scope = await warehouseScopeIds()
  const items = await db.toolLoanItem.findMany({
    where: {
      status: { in: ["OPEN", "PARTIAL"] },
      loan: {
        recipientId: employeeId,
        status: { in: ["OPEN", "PARTIAL"] },
        ...(scope !== null ? { warehouseId: { in: scope } } : {}),
      },
    },
    include: {
      loan: { select: { id: true, loanNumber: true, loanedAt: true } },
      toolAsset: {
        select: {
          id: true,
          code: true,
          qrToken: true,
          name: true,
          category: true,
          brand: true,
          trackingType: true,
          unit: true,
        },
      },
      product: { include: { unit: true } },
    },
    orderBy: [{ loan: { loanedAt: "asc" } }, { createdAt: "asc" }],
  })

  void warehouseId
  return items.map(mapLoanItemToDTO).filter((it) => it.quantityPending > 0)
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

/**
 * Consulta uma ferramenta da Ferramentaria pelo QR Code, patrimônio/código ou nome.
 * Prioriza o almoxarifado atual, mas também aceita qualquer ferramenta ativa no escopo do operador
 * para nunca travar a entrega por diferença de obra/almoxarifado.
 */
export async function lookupToolForLoan(warehouseId: string, rawCode: string) {
  let session
  try {
    session = await requireLoanPermission()
  } catch {
    return { error: "Não autorizado." }
  }

  const code = rawCode.trim()
  if (!code) return { error: "Informe ou escaneie o QR Code / patrimônio da ferramenta." }

  const scope = await warehouseScopeIds(session.userId)
  const scopeFilter = scope !== null ? { warehouseId: { in: scope } } : {}

  const exactConditions = [
    { qrToken: { equals: code } },
    { code: { equals: code } },
    { serialNumber: { equals: code } },
    { id: code },
  ]
  const partialConditions = [
    { code: { contains: code } },
    { name: { contains: code } },
    { brand: { contains: code } },
  ]

  // 1º tenta no almoxarifado selecionado; 2º em qualquer almoxarifado acessível pelo operador
  const tool =
    (warehouseId
      ? await db.toolAsset.findFirst({
          where: { warehouseId, status: "ACTIVE", OR: exactConditions },
        })
      : null) ??
    (await db.toolAsset.findFirst({
      where: { ...scopeFilter, status: "ACTIVE", OR: exactConditions },
    })) ??
    (warehouseId
      ? await db.toolAsset.findFirst({
          where: { warehouseId, status: "ACTIVE", OR: partialConditions },
          orderBy: { code: "asc" },
        })
      : null) ??
    (await db.toolAsset.findFirst({
      where: { ...scopeFilter, status: "ACTIVE", OR: partialConditions },
      orderBy: { code: "asc" },
    }))

  if (!tool) {
    return {
      error: `Ferramenta "${code}" não encontrada na Ferramentaria. Cadastre-a na aba "Ferramentas".`,
    }
  }

  if (tool.condition === "MAINTENANCE" || tool.condition === "DAMAGED") {
    return {
      error: `A ferramenta "${tool.name}" (${tool.code}) está marcada como ${
        tool.condition === "MAINTENANCE" ? "Em Manutenção" : "Danificada"
      } e não pode ser emprestada.`,
    }
  }

  const activeLoanItems = await db.toolLoanItem.findMany({
    where: {
      toolAssetId: tool.id,
      status: { in: ["OPEN", "PARTIAL"] },
      loan: { status: { in: ["OPEN", "PARTIAL"] } },
    },
    include: {
      loan: {
        include: {
          recipient: { select: { name: true, employeeCode: true } },
        },
      },
    },
  })

  const loanedQuantity = activeLoanItems.reduce(
    (sum, it) => sum + Math.max(0, it.quantityLoaned - it.quantityReturned),
    0
  )
  const availableQuantity = Math.max(0, tool.totalQuantity - loanedQuantity)

  if (availableQuantity <= 0) {
    const holderNames = activeLoanItems
      .filter((it) => it.quantityLoaned - it.quantityReturned > 0)
      .map((it) => it.loan.recipient.name)
      .join(", ")
    return {
      error: holderNames
        ? `"${tool.name}" (${tool.code}) já está emprestada para: ${holderNames}.`
        : `"${tool.name}" (${tool.code}) está sem unidades disponíveis na Ferramentaria.`,
    }
  }

  return {
    success: true as const,
    tool: {
      id: tool.id,
      code: tool.code,
      qrToken: tool.qrToken,
      name: tool.name,
      category: tool.category,
      brand: tool.brand,
      trackingType: (tool.trackingType === "QUANTITY" ? "QUANTITY" : "ASSET") as ToolTrackingType,
      unit: tool.unit,
      totalQuantity: tool.totalQuantity,
      loanedQuantity,
      availableQuantity,
    },
  }
}

/**
 * Registra o empréstimo de ferramentas na Ferramentaria.
 * NÃO altera Stock nem gera StockMovement (totalmente separado do estoque de materiais).
 */
export async function confirmToolLoan(payload: {
  employeeId: string
  worksiteId: string
  warehouseId: string
  notes?: string
  items: {
    toolAssetId: string
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
    return { error: "Adicione pelo menos uma ferramenta para emprestar." }
  }

  try {
    const loanResult = await createWithUniqueNumber(
      async (attempt) => {
        const count = await db.toolLoan.count()
        return `FER-${String(count + 1 + attempt).padStart(6, "0")}`
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
            const tool = await tx.toolAsset.findFirst({
              where: {
                id: item.toolAssetId,
                status: "ACTIVE",
              },
            })
            if (!tool) {
              throw new Error("Ferramenta não encontrada ou inativa.")
            }

            const openLoanItems = await tx.toolLoanItem.findMany({
              where: {
                toolAssetId: tool.id,
                status: { in: ["OPEN", "PARTIAL"] },
                loan: { status: { in: ["OPEN", "PARTIAL"] } },
              },
              select: { quantityLoaned: true, quantityReturned: true },
            })
            const currentlyLoaned = openLoanItems.reduce(
              (sum, li) => sum + Math.max(0, li.quantityLoaned - li.quantityReturned),
              0
            )
            const available = Math.max(0, tool.totalQuantity - currentlyLoaned)

            if (qtyWanted > available) {
              throw new Error(
                `Quantidade indisponível para "${tool.name}" (${tool.code}) — disponível: ${available}, solicitado: ${qtyWanted}.`
              )
            }

            await tx.toolLoanItem.create({
              data: {
                loanId: loan.id,
                toolAssetId: tool.id,
                quantityLoaned: qtyWanted,
                quantityReturned: 0,
                status: "OPEN",
              },
            })
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

    return {
      success: true as const,
      loanNumber: loanResult.loanNumber,
      openItems,
    }
  } catch (error) {
    console.error("confirmToolLoan error:", error)
    return { error: error instanceof Error ? error.message : "Erro ao registrar empréstimo de ferramenta." }
  }
}

/**
 * Registra a devolução (total ou parcial) de uma ferramenta na Ferramentaria.
 * NÃO altera Stock nem gera StockMovement.
 */
export async function returnToolLoanItem(payload: {
  itemId: string
  quantityReturning: number
  conditionAfterReturn?: "GOOD" | "MAINTENANCE" | "DAMAGED"
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
      toolAsset: true,
      product: { include: { unit: true } },
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
    return { error: "Esta ferramenta já foi totalmente devolvida." }
  }

  if (qtyReturning > pendingBefore) {
    return {
      error: `Quantidade maior que o pendente! Foi emprestado ${loanItem.quantityLoaned} (${pendingBefore} pendente) e tentou devolver ${qtyReturning}.`,
    }
  }

  const newTotalReturned = loanItem.quantityReturned + qtyReturning
  const missingAfter = loanItem.quantityLoaned - newTotalReturned
  const newItemStatus = missingAfter === 0 ? "RETURNED" : "PARTIAL"

  const toolCode = loanItem.toolAsset?.code ?? loanItem.product?.code ?? "SEM-COD"
  const toolName = loanItem.toolAsset?.name ?? loanItem.product?.name ?? "Ferramenta"
  const unitCode = loanItem.toolAsset?.unit ?? loanItem.product?.unit.code ?? "UN"

  try {
    await db.$transaction(async (tx) => {
      const noteText =
        missingAfter > 0
          ? [
              payload.notes?.trim(),
              `Devolveu ${newTotalReturned} de ${loanItem.quantityLoaned} (faltam ${missingAfter})`,
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

      if (
        loanItem.toolAssetId &&
        payload.conditionAfterReturn &&
        ["GOOD", "MAINTENANCE", "DAMAGED"].includes(payload.conditionAfterReturn)
      ) {
        await tx.toolAsset.update({
          where: { id: loanItem.toolAssetId },
          data: { condition: payload.conditionAfterReturn },
        })
      }

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
          toolCode,
          toolName,
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
      const alertTitle = `Divergência na Ferramentaria (${loanItem.loan.loanNumber})`
      const alertMessage = `${loanItem.loan.recipient.name} devolveu ${newTotalReturned} ${unitCode} de "${toolName}" (${toolCode}), mas retirou ${loanItem.quantityLoaned} ${unitCode}. Faltam ${missingAfter} ${unitCode}!`
      await sendNotification(session.userId, alertTitle, alertMessage, "WARNING")
    }

    const openItems = await getEmployeeOpenLoanItems(loanItem.loan.recipientId, loanItem.loan.warehouseId)
    revalidatePath("/tool-loans")

    return {
      success: true as const,
      openItems,
      returnedTool: {
        code: toolCode,
        name: toolName,
        unit: unitCode,
      },
      discrepancy:
        missingAfter > 0
          ? {
              employeeName: loanItem.loan.recipient.name,
              productName: `${toolName} (${toolCode})`,
              unitCode,
              loaned: loanItem.quantityLoaned,
              returnedNow: qtyReturning,
              totalReturned: newTotalReturned,
              missing: missingAfter,
              message: `Ele devolveu ${newTotalReturned}, mas retirou ${loanItem.quantityLoaned}! Faltam ${missingAfter} ${unitCode}.`,
            }
          : null,
    }
  } catch (error) {
    console.error("returnToolLoanItem error:", error)
    return { error: error instanceof Error ? error.message : "Erro ao registrar devolução." }
  }
}

/**
 * Lista o inventário de ferramentas da Ferramentaria + empréstimos em aberto.
 */
export async function listToolRoomData(explicitWarehouseId?: string): Promise<{
  summaries: OpenEmployeeLoanSummary[]
  tools: ToolAssetDTO[]
  warehouses: { id: string; code: string; name: string }[]
  activeWarehouseId: string | null
  activeWarehouseName: string | null
}> {
  let session
  try {
    session = await requireLoanPermission()
  } catch {
    return {
      summaries: [],
      tools: [],
      warehouses: [],
      activeWarehouseId: null,
      activeWarehouseName: null,
    }
  }

  const accessibleWarehouses = await getAccessibleWarehouses(session.userId)
  const scope = await warehouseScopeIds(session.userId)
  const cookieWhId = (await cookies()).get("cgstock_active_warehouse")?.value || ""
  const candidateWhId = explicitWarehouseId ?? cookieWhId

  let activeWarehouseId: string | null = null
  let activeWarehouseName: string | null = null

  if (candidateWhId) {
    const matched = accessibleWarehouses.find((w) => w.id === candidateWhId)
    if (matched) {
      activeWarehouseId = matched.id
      activeWarehouseName = matched.name
    }
  }
  if (!activeWarehouseId && accessibleWarehouses.length === 1) {
    activeWarehouseId = accessibleWarehouses[0].id
    activeWarehouseName = accessibleWarehouses[0].name
  }

  const warehouseFilter = activeWarehouseId
    ? { warehouseId: activeWarehouseId }
    : scope !== null
    ? { warehouseId: { in: scope } }
    : {}

  const [openItems, rawTools] = await Promise.all([
    db.toolLoanItem.findMany({
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
        toolAsset: {
          select: {
            id: true,
            code: true,
            qrToken: true,
            name: true,
            category: true,
            brand: true,
            trackingType: true,
            unit: true,
          },
        },
        product: { include: { unit: true } },
      },
      orderBy: [{ loan: { loanedAt: "asc" } }, { createdAt: "asc" }],
    }),
    db.toolAsset.findMany({
      where: {
        ...warehouseFilter,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { category: "asc" }, { name: "asc" }, { code: "asc" }],
    }),
  ])

  const byKey = new Map<string, OpenEmployeeLoanSummary>()
  const holdersByToolId = new Map<string, ToolAssetDTO["currentHolders"]>()

  for (const it of openItems) {
    const pending = Math.max(0, it.quantityLoaned - it.quantityReturned)
    if (pending <= 0) continue

    if (it.toolAssetId) {
      const holders = holdersByToolId.get(it.toolAssetId) ?? []
      holders.push({
        itemId: it.id,
        loanNumber: it.loan.loanNumber,
        employeeId: it.loan.recipient.id,
        employeeName: it.loan.recipient.name,
        employeeCode: it.loan.recipient.employeeCode,
        quantityPending: pending,
        loanedAt: it.loan.loanedAt.toISOString(),
      })
      holdersByToolId.set(it.toolAssetId, holders)
    }

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
    group.items.push(mapLoanItemToDTO(it))
  }

  const tools: ToolAssetDTO[] = rawTools.map((t) => {
    const holders = holdersByToolId.get(t.id) ?? []
    const loanedQuantity = holders.reduce((sum, h) => sum + h.quantityPending, 0)
    const availableQuantity = Math.max(0, t.totalQuantity - loanedQuantity)
    return {
      id: t.id,
      warehouseId: t.warehouseId,
      warehouseName: t.warehouse.name,
      warehouseCode: t.warehouse.code,
      code: t.code,
      qrToken: t.qrToken,
      name: t.name,
      category: t.category,
      brand: t.brand,
      serialNumber: t.serialNumber,
      trackingType: t.trackingType === "QUANTITY" ? "QUANTITY" : "ASSET",
      totalQuantity: t.totalQuantity,
      loanedQuantity,
      availableQuantity,
      unit: t.unit,
      condition: t.condition,
      status: t.status,
      notes: t.notes,
      currentHolders: holders,
    }
  })

  return {
    summaries: Array.from(byKey.values()),
    tools,
    warehouses: accessibleWarehouses.map((w) => ({ id: w.id, code: w.code, name: w.name })),
    activeWarehouseId,
    activeWarehouseName,
  }
}

export async function listOpenToolLoans() {
  const data = await listToolRoomData()
  return {
    summaries: data.summaries,
    activeWarehouseName: data.activeWarehouseName,
  }
}

/**
 * Cadastra uma nova ferramenta/equipamento no inventário da Ferramentaria.
 */
export async function createToolAssetAction(input: {
  warehouseId: string
  code: string
  name: string
  category?: string
  brand?: string
  serialNumber?: string
  trackingType: ToolTrackingType
  totalQuantity?: number
  unit?: string
  condition?: string
  notes?: string
}) {
  let session
  try {
    session = await requireLoanPermission()
  } catch {
    return { error: "Não autorizado." }
  }

  const warehouseId = input.warehouseId?.trim()
  const code = input.code?.trim().toUpperCase()
  const name = input.name?.trim()

  if (!warehouseId) return { error: "Selecione o almoxarifado da ferramenta." }
  if (!code) return { error: "Informe o código / patrimônio da ferramenta (ex.: CV-360, PA-BICO)." }
  if (!name) return { error: "Informe o nome da ferramenta (ex.: Furadeira DeWalt, Pá de Bico)." }

  try {
    await assertWarehouseAccess(warehouseId, session.userId)
  } catch {
    return { error: "Você não tem acesso a este almoxarifado." }
  }

  const duplicate = await db.toolAsset.findUnique({
    where: { warehouseId_code: { warehouseId, code } },
  })
  if (duplicate) {
    return { error: `Já existe uma ferramenta com o código/patrimônio "${code}" neste almoxarifado.` }
  }

  const totalQuantity = Math.max(1, Math.floor(Number(input.totalQuantity) || 1))
  const trackingType: ToolTrackingType = totalQuantity > 1 ? "QUANTITY" : "ASSET"
  const unit = (input.unit?.trim().toUpperCase() || "UN").slice(0, 10)
  const condition = ["GOOD", "MAINTENANCE", "DAMAGED"].includes(input.condition || "")
    ? input.condition!
    : "GOOD"

  // Token QR: se o código não conflitar globalmente, usa o próprio código; caso contrário, prefixa com código do almoxarifado
  let qrToken = code
  const existingToken = await db.toolAsset.findUnique({ where: { qrToken } })
  if (existingToken) {
    const wh = await db.warehouse.findUnique({ where: { id: warehouseId }, select: { code: true } })
    const candidate = `${wh?.code ?? "FER"}:${code}`
    const existingCandidate = await db.toolAsset.findUnique({ where: { qrToken: candidate } })
    qrToken = existingCandidate ? `${candidate}:${Date.now().toString(36).toUpperCase()}` : candidate
  }

  try {
    const created = await db.toolAsset.create({
      data: {
        warehouseId,
        code,
        qrToken,
        name,
        category: input.category?.trim() || null,
        brand: input.brand?.trim() || null,
        serialNumber: input.serialNumber?.trim() || null,
        trackingType,
        totalQuantity,
        unit,
        condition,
        status: "ACTIVE",
        notes: input.notes?.trim() || null,
      },
    })

    await logAudit(
      "TOOL_ASSET_CREATED",
      "ToolAsset",
      created.id,
      { warehouseId, code, name, trackingType, totalQuantity },
      session.userId
    )

    revalidatePath("/tool-loans")
    revalidatePath("/tool-loans/print-labels")

    return { success: true as const, toolId: created.id }
  } catch (error) {
    console.error("createToolAssetAction error:", error)
    return { error: error instanceof Error ? error.message : "Erro ao cadastrar ferramenta." }
  }
}

/**
 * Atualiza os dados de uma ferramenta cadastrada na Ferramentaria.
 */
export async function updateToolAssetAction(input: {
  id: string
  code: string
  name: string
  category?: string
  brand?: string
  serialNumber?: string
  trackingType: ToolTrackingType
  totalQuantity?: number
  unit?: string
  condition?: string
  status?: string
  notes?: string
}) {
  let session
  try {
    session = await requireLoanPermission()
  } catch {
    return { error: "Não autorizado." }
  }

  const existing = await db.toolAsset.findUnique({ where: { id: input.id } })
  if (!existing) return { error: "Ferramenta não encontrada." }

  try {
    await assertWarehouseAccess(existing.warehouseId, session.userId)
  } catch {
    return { error: "Você não tem acesso a este almoxarifado." }
  }

  const code = input.code?.trim().toUpperCase()
  const name = input.name?.trim()
  if (!code || !name) return { error: "Código/patrimônio e nome são obrigatórios." }

  if (code !== existing.code) {
    const dup = await db.toolAsset.findUnique({
      where: { warehouseId_code: { warehouseId: existing.warehouseId, code } },
    })
    if (dup && dup.id !== existing.id) {
      return { error: `Já existe outra ferramenta com o código/patrimônio "${code}" neste almoxarifado.` }
    }
  }

  const totalQuantity = Math.max(1, Math.floor(Number(input.totalQuantity) || 1))
  const trackingType: ToolTrackingType = totalQuantity > 1 ? "QUANTITY" : "ASSET"

  try {
    await db.toolAsset.update({
      where: { id: existing.id },
      data: {
        code,
        name,
        category: input.category?.trim() || null,
        brand: input.brand?.trim() || null,
        serialNumber: input.serialNumber?.trim() || null,
        trackingType,
        totalQuantity,
        unit: (input.unit?.trim().toUpperCase() || existing.unit).slice(0, 10),
        condition: ["GOOD", "MAINTENANCE", "DAMAGED"].includes(input.condition || "")
          ? input.condition!
          : existing.condition,
        status: input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        notes: input.notes?.trim() || null,
      },
    })

    await logAudit(
      "TOOL_ASSET_UPDATED",
      "ToolAsset",
      existing.id,
      { code, name, trackingType, totalQuantity, condition: input.condition, status: input.status },
      session.userId
    )

    revalidatePath("/tool-loans")
    revalidatePath("/tool-loans/print-labels")

    return { success: true as const }
  } catch (error) {
    console.error("updateToolAssetAction error:", error)
    return { error: error instanceof Error ? error.message : "Erro ao atualizar ferramenta." }
  }
}
