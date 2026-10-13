import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AdjustmentClient } from "./client"

export const metadata = {
  title: "Ajuste Manual de Estoque | CGStock",
}

export default async function NewAdjustmentPage() {
  await requirePermissionPage('STOCK_ENTRY')
  const session = await getValidatedSession()
  if (!session) redirect("/login")

  const scope = await warehouseScopeIds()
  const warehouses = await db.warehouse.findMany({
    where: { status: 'ACTIVE', id: { in: scope ?? undefined } },
    orderBy: { name: 'asc' },
    include: { locations: true }
  })

  const products = await db.product.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true, category: { select: { name: true } } }
  })

  return <AdjustmentClient warehouses={warehouses} products={products} userId={session.userId} sessionExpiresAt={new Date(session.expiresAt).toISOString()} />
}
