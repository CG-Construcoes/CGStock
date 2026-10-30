"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/action-guard"
import { hasAnyPermission } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import crypto from "crypto"

async function requireEmployeeManagePermission() {
  const session = await requireSession()
  if (session.roles?.includes("ADMIN")) return session
  const allowed = await hasAnyPermission("USER_MANAGE", "PRODUCT_CREATE", "STOCK_EXIT")
  if (!allowed) {
    throw new Error("Sem permissão para gerenciar colaboradores.")
  }
  return session
}

export type EmployeeBatchItem = {
  employeeCode?: string | null
  name: string
  document?: string | null
  phone?: string | null
  fantasia?: string | null
  qrToken?: string | null
}

export async function importEmployeesBatchAction(
  rows: EmployeeBatchItem[],
  targetWarehouseId?: string
) {
  let session
  try {
    session = await requireEmployeeManagePermission()
  } catch {
    return { success: false, message: "Sem permissão para gerenciar funcionários." }
  }

  if (!rows || rows.length === 0) {
    return { success: true, inserted: 0, updated: 0, errors: [] }
  }

  // Almoxarifado padrão se não especificado
  let warehouseId = targetWarehouseId
  if (!warehouseId) {
    const defaultWarehouse = await db.warehouse.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true }
    })
    warehouseId = defaultWarehouse?.id
  }

  let inserted = 0
  let updated = 0
  const errors: string[] = []

  // Validar e preparar dados limpos
  const validRows = rows.map((r, idx) => {
    const name = String(r.name || "").trim()
    const employeeCode = r.employeeCode ? String(r.employeeCode).trim() : null
    const rawDoc = r.document ? String(r.document).trim() : null
    const cleanDoc = rawDoc ? rawDoc.replace(/\D/g, "") : null
    const phone = r.phone ? String(r.phone).trim() : null
    const cleanPhone = phone === "00000000000" || phone === "0" ? null : phone
    const qrToken = r.qrToken || (employeeCode ? `EMP-${employeeCode}` : null)

    return {
      name,
      employeeCode,
      document: cleanDoc || rawDoc,
      phone: cleanPhone,
      qrToken,
      originalIndex: idx
    }
  }).filter(r => {
    if (!r.name) {
      errors.push(`Linha ${r.originalIndex + 1}: Nome do funcionário está vazio.`)
      return false
    }
    return true
  })

  if (validRows.length === 0) {
    return { success: true, inserted: 0, updated: 0, errors }
  }

  // Buscar códigos existentes para saber quem atualizar vs quem inserir
  const codes = validRows.map(r => r.employeeCode).filter(Boolean) as string[]
  const existingByCode = codes.length > 0
    ? await db.user.findMany({
        where: { employeeCode: { in: codes } },
        select: { id: true, employeeCode: true, qrToken: true }
      })
    : []

  const existingMap = new Map<string, { id: string; qrToken: string | null }>()
  for (const ex of existingByCode) {
    if (ex.employeeCode) existingMap.set(ex.employeeCode, ex)
  }

  const toInsert: typeof validRows = []
  const toUpdate: typeof validRows = []

  for (const row of validRows) {
    if (row.employeeCode && existingMap.has(row.employeeCode)) {
      toUpdate.push(row)
    } else {
      toInsert.push(row)
    }
  }

  // 1. Inserir novos funcionários (loginEnabled: false SEMPRE)
  if (toInsert.length > 0) {
    try {
      const createData = toInsert.map(r => ({
        id: crypto.randomUUID(),
        name: r.name,
        employeeCode: r.employeeCode,
        document: r.document,
        phone: r.phone,
        qrToken: r.qrToken || `EMP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        status: "ACTIVE",
        loginEnabled: false, // Campo apenas, sem login
      }))

      await db.user.createMany({
        data: createData,
        skipDuplicates: true
      })
      inserted += createData.length

      // Vincular ao almoxarifado se houver um ativo
      if (warehouseId) {
        try {
          await db.userWarehouseAccess.createMany({
            data: createData.map(u => ({
              userId: u.id,
              warehouseId: warehouseId!,
              grantedById: session.userId
            })),
            skipDuplicates: true
          })
        } catch (accessErr) {
          // Ignora erro de FK se usuário já existia antes com outro UUID
        }
      }
    } catch (err: any) {
      console.error("Erro no createMany de funcionários:", err)
      // Fallback linha a linha caso haja colisão de qrToken
      for (const r of toInsert) {
        try {
          const fallbackQr = r.qrToken || `EMP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
          const created = await db.user.create({
            data: {
              name: r.name,
              employeeCode: r.employeeCode,
              document: r.document,
              phone: r.phone,
              qrToken: fallbackQr,
              status: "ACTIVE",
              loginEnabled: false
            }
          })
          inserted++
          if (warehouseId) {
            await db.userWarehouseAccess.create({
              data: {
                userId: created.id,
                warehouseId,
                grantedById: session.userId
              }
            }).catch(() => {})
          }
        } catch (singleErr: any) {
          errors.push(`Erro ao inserir ${r.name} (${r.employeeCode}): ${singleErr.message}`)
        }
      }
    }
  }

  // 2. Atualizar funcionários existentes (sem sobrescrever se tiver login ativo)
  for (const r of toUpdate) {
    try {
      const existing = existingMap.get(r.employeeCode!)
      if (existing) {
        await db.user.update({
          where: { id: existing.id },
          data: {
            name: r.name,
            document: r.document,
            phone: r.phone,
            qrToken: existing.qrToken || r.qrToken
          }
        })
        updated++

        if (warehouseId) {
          await db.userWarehouseAccess.upsert({
            where: {
              userId_warehouseId: {
                userId: existing.id,
                warehouseId
              }
            },
            update: {},
            create: {
              userId: existing.id,
              warehouseId,
              grantedById: session.userId
            }
          }).catch(() => {})
        }
      }
    } catch (updateErr: any) {
      errors.push(`Erro ao atualizar ${r.name} (${r.employeeCode}): ${updateErr.message}`)
    }
  }

  return {
    success: true,
    inserted,
    updated,
    errors
  }
}

export async function createEmployeeAction(formData: FormData) {
  let session
  try {
    session = await requireEmployeeManagePermission()
  } catch {
    return { error: "Sem permissão." }
  }

  const name = String(formData.get("name") || "").trim()
  const employeeCode = String(formData.get("employeeCode") || "").trim() || null
  const document = String(formData.get("document") || "").trim() || null
  const phone = String(formData.get("phone") || "").trim() || null
  const worksiteId = String(formData.get("worksiteId") || "").trim() || null
  const warehouseId = String(formData.get("warehouseId") || "").trim() || worksiteId

  if (!name) {
    return { error: "O nome do funcionário é obrigatório." }
  }

  if (employeeCode) {
    const existing = await db.user.findFirst({
      where: { employeeCode }
    })
    if (existing) {
      return { error: `Já existe um colaborador cadastrado com a matrícula ${employeeCode}.` }
    }
  }

  const qrToken = employeeCode
    ? `EMP-${employeeCode}`
    : `EMP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

  try {
    const user = await db.user.create({
      data: {
        name,
        employeeCode,
        document,
        phone,
        qrToken,
        status: "ACTIVE",
        loginEnabled: false, // Funcionário de campo não tem login por padrão
        warehouseAccesses: warehouseId ? {
          create: {
            warehouseId,
            grantedById: session.userId
          }
        } : undefined
      }
    })

    await logAudit("EMPLOYEE_CREATED", "User", user.id, {
      name: user.name,
      employeeCode: user.employeeCode,
      document: user.document
    }, session.userId)

    revalidatePath("/admin/employees")
    return { success: true, employeeId: user.id }
  } catch (error: any) {
    console.error("Erro ao criar funcionário:", error)
    return { error: "Erro interno ao cadastrar funcionário." }
  }
}

export async function updateEmployeeAction(
  employeeId: string,
  data: {
    name: string
    employeeCode?: string | null
    document?: string | null
    phone?: string | null
    status?: string
    warehouseId?: string | null
  }
) {
  let session
  try {
    session = await requireEmployeeManagePermission()
  } catch {
    return { error: "Sem permissão." }
  }

  const name = data.name.trim()
  if (!name) return { error: "O nome é obrigatório." }

  try {
    if (data.employeeCode) {
      const conflict = await db.user.findFirst({
        where: {
          employeeCode: data.employeeCode,
          id: { not: employeeId }
        }
      })
      if (conflict) {
        return { error: `A matrícula ${data.employeeCode} já pertence a outro colaborador.` }
      }
    }

    const updated = await db.user.update({
      where: { id: employeeId },
      data: {
        name,
        employeeCode: data.employeeCode || null,
        document: data.document || null,
        phone: data.phone || null,
        status: data.status || undefined
      }
    })

    if (data.warehouseId) {
      // O colaborador pertence a um único almoxarifado por vez — substitui o vínculo anterior
      await db.$transaction(async (tx) => {
        await tx.userWarehouseAccess.deleteMany({ where: { userId: employeeId } })
        await tx.userWarehouseAccess.create({
          data: {
            userId: employeeId,
            warehouseId: data.warehouseId!,
            grantedById: session.userId
          }
        }).catch(() => {})
      })
    }

    await logAudit("EMPLOYEE_UPDATED", "User", updated.id, {
      name: updated.name,
      employeeCode: updated.employeeCode
    }, session.userId)

    revalidatePath("/admin/employees")
    return { success: true }
  } catch (error: any) {
    console.error("Erro ao atualizar funcionário:", error)
    return { error: "Erro ao atualizar dados do funcionário." }
  }
}

export async function assignEmployeesWarehouseAction(employeeIds: string[], warehouseId: string) {
  let session
  try {
    session = await requireEmployeeManagePermission()
  } catch {
    return { error: "Sem permissão." }
  }

  if (!employeeIds || employeeIds.length === 0) return { error: "Nenhum funcionário selecionado." }
  if (!warehouseId) return { error: "Selecione um almoxarifado." }

  const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, status: "ACTIVE" }, select: { id: true } })
  if (!warehouse) return { error: "Almoxarifado inválido." }

  try {
    // Transferência: cada colaborador passa a pertencer apenas ao almoxarifado escolhido
    await db.$transaction(async (tx) => {
      await tx.userWarehouseAccess.deleteMany({ where: { userId: { in: employeeIds } } })
      await tx.userWarehouseAccess.createMany({
        data: employeeIds.map(userId => ({
          userId,
          warehouseId,
          grantedById: session.userId
        })),
        skipDuplicates: true
      })
    })

    await logAudit("EMPLOYEES_WAREHOUSE_ASSIGNED", "UserWarehouseAccess", warehouseId, {
      employeeCount: employeeIds.length,
      warehouseId
    }, session.userId)

    revalidatePath("/admin/employees")
    return { success: true, assigned: employeeIds.length }
  } catch (error: any) {
    console.error("Erro ao vincular funcionários ao almoxarifado:", error)
    return { error: "Erro ao vincular funcionários ao almoxarifado." }
  }
}

export async function toggleEmployeeStatusAction(employeeId: string) {
  let session
  try {
    session = await requireEmployeeManagePermission()
  } catch {
    return { error: "Sem permissão." }
  }

  try {
    const employee = await db.user.findUnique({
      where: { id: employeeId },
      select: { id: true, status: true, name: true }
    })

    if (!employee) return { error: "Funcionário não encontrado." }

    const newStatus = employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    await db.user.update({
      where: { id: employeeId },
      data: { status: newStatus }
    })

    await logAudit("EMPLOYEE_STATUS_CHANGED", "User", employee.id, {
      oldStatus: employee.status,
      newStatus
    }, session.userId)

    revalidatePath("/admin/employees")
    return { success: true, newStatus }
  } catch (error) {
    return { error: "Erro ao alterar status." }
  }
}

export async function regenerateEmployeeQrAction(employeeId: string) {
  let session
  try {
    session = await requireEmployeeManagePermission()
  } catch {
    return { error: "Sem permissão." }
  }

  try {
    const employee = await db.user.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeCode: true }
    })
    if (!employee) return { error: "Funcionário não encontrado." }

    const newToken = employee.employeeCode
      ? `EMP-${employee.employeeCode}`
      : `EMP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

    await db.user.update({
      where: { id: employeeId },
      data: { qrToken: newToken, qrStatus: "ACTIVE" }
    })

    revalidatePath("/admin/employees")
    return { success: true, qrToken: newToken }
  } catch (error) {
    return { error: "Erro ao gerar novo QR Code." }
  }
}
