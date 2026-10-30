import { db } from "@/lib/db"
import { requireAnyPermissionPage } from "@/lib/permissions"
import { PrintBadgesClient } from "./print-badges-client"

export const metadata = {
  title: "Imprimir Etiquetas de Capacete & Crachás - CGStock",
}

export default async function PrintBadgesPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; limit?: string }>
}) {
  await requireAnyPermissionPage("USER_VIEW", "USER_MANAGE", "STOCK_EXIT")

  const resolved = await searchParams
  const ids = resolved?.ids ? resolved.ids.split(",").map((s) => s.trim()).filter(Boolean) : []
  const limit = ids.length > 0 ? ids.length : Math.min(parseInt(resolved?.limit || "60", 10), 300)

  const whereCondition: any = {
    status: "ACTIVE",
  }

  if (ids.length > 0) {
    whereCondition.id = { in: ids }
  }

  const employees = await db.user.findMany({
    where: whereCondition,
    select: {
      id: true,
      name: true,
      employeeCode: true,
      document: true,
      phone: true,
      email: true,
      qrToken: true,
      warehouseAccesses: {
        select: {
          warehouse: { select: { name: true, code: true } },
        },
      },
    },
    orderBy: [{ employeeCode: "asc" }, { name: "asc" }],
    take: limit,
  })

  const totalActive = await db.user.count({ where: { status: "ACTIVE" } })

  return (
    <PrintBadgesClient
      employees={employees}
      isFiltered={ids.length > 0}
      totalActive={totalActive}
    />
  )
}
