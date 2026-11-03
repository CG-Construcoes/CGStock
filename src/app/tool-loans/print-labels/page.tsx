import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getValidatedSession } from "@/lib/auth"
import { hasAnyPermission } from "@/lib/permissions"
import { warehouseScopeIds } from "@/lib/dal"
import { db } from "@/lib/db"
import { PrintToolLabelsClient, type ToolLabelItem } from "./print-labels-client"

export default async function PrintToolLabelsPage(props: {
  searchParams?: Promise<{ warehouseId?: string; ids?: string }>
}) {
  const session = await getValidatedSession()
  if (!session) redirect("/login")

  const allowed = await hasAnyPermission("STOCK_EXIT", "STOCK_ENTRY")
  if (!allowed) redirect("/unauthorized")

  const resolvedParams = props.searchParams ? await props.searchParams : {}
  const scope = await warehouseScopeIds(session.userId)
  const cookieWhId = (await cookies()).get("cgstock_active_warehouse")?.value || ""
  const effectiveWhId = resolvedParams.warehouseId || cookieWhId

  const idsList = (resolvedParams.ids || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const whereClause =
    idsList.length > 0
      ? {
          id: { in: idsList },
          ...(scope !== null ? { warehouseId: { in: scope } } : {}),
        }
      : {
          status: "ACTIVE",
          ...(effectiveWhId
            ? { warehouseId: effectiveWhId }
            : scope !== null
            ? { warehouseId: { in: scope } }
            : {}),
        }

  const rawTools = await db.toolAsset.findMany({
    where: whereClause,
    include: {
      warehouse: { select: { name: true, code: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }, { code: "asc" }],
  })

  const tools: ToolLabelItem[] = rawTools.map((t) => ({
    id: t.id,
    code: t.code,
    qrToken: t.qrToken,
    name: t.name,
    category: t.category,
    brand: t.brand,
    trackingType: t.trackingType === "QUANTITY" ? "QUANTITY" : "ASSET",
    totalQuantity: t.totalQuantity,
    unit: t.unit,
    warehouseName: t.warehouse.name,
    warehouseCode: t.warehouse.code,
  }))

  return <PrintToolLabelsClient tools={tools} />
}
