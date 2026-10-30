import { db } from "@/lib/db"
import { requireAnyPermissionPage } from "@/lib/permissions"
import { EmployeesClient } from "./employees-client"

export const metadata = {
  title: "Funcionários & Equipe de Campo - CGStock",
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    page?: string
    type?: string
    warehouse?: string
    worksite?: string
  }>
}) {
  await requireAnyPermissionPage("USER_VIEW", "USER_MANAGE", "STOCK_EXIT")

  const resolved = await searchParams
  const q = resolved?.q?.trim() || ""
  const page = Math.max(1, parseInt(resolved?.page || "1", 10) || 1)
  const typeFilter = resolved?.type || "ALL" // 'ALL' | 'FIELD' | 'SYSTEM'
  // Aceita ?warehouse= (novo) e ?worksite= (links antigos) — o vínculo é por almoxarifado
  const warehouseFilter = resolved?.warehouse || resolved?.worksite || "ALL" // 'ALL' | 'NONE' | <warehouseId>
  const pageSize = 50

  const whereCondition: any = {}

  if (typeFilter === "FIELD") {
    whereCondition.loginEnabled = false
  } else if (typeFilter === "SYSTEM") {
    whereCondition.loginEnabled = true
  }

  if (warehouseFilter === "NONE") {
    whereCondition.warehouseAccesses = { none: {} }
  } else if (warehouseFilter !== "ALL") {
    whereCondition.warehouseAccesses = { some: { warehouseId: warehouseFilter } }
  }

  if (q) {
    const cleanDigits = q.replace(/\D/g, "")
    whereCondition.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { employeeCode: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { qrToken: { contains: q, mode: "insensitive" } },
      ...(cleanDigits.length >= 3 ? [{ document: { contains: cleanDigits } }] : [{ document: { contains: q } }]),
      { phone: { contains: q } },
    ]
  }

  const [
    totalEmployees,
    activeField,
    systemUsers,
    withQrCode,
    totalMatching,
    employees,
    warehouses,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { loginEnabled: false, status: "ACTIVE" } }),
    db.user.count({ where: { loginEnabled: true } }),
    db.user.count({ where: { qrToken: { not: null }, status: "ACTIVE" } }),
    db.user.count({ where: whereCondition }),
    db.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        employeeCode: true,
        document: true,
        phone: true,
        email: true,
        status: true,
        loginEnabled: true,
        qrToken: true,
        qrStatus: true,
        createdAt: true,
        roles: { select: { id: true, name: true } },
        warehouseAccesses: {
          select: {
            warehouse: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ employeeCode: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.warehouse.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize))

  return (
    <EmployeesClient
      employees={employees}
      stats={{
        total: totalEmployees,
        activeField,
        systemUsers,
        withQrCode,
      }}
      warehouses={warehouses}
      pagination={{
        page,
        pageSize,
        totalPages,
        totalItems: totalMatching,
      }}
      currentFilter={{
        q,
        type: typeFilter,
        warehouse: warehouseFilter,
      }}
    />
  )
}
