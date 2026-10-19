import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import RequestForm from "./request-form"
import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function NewRequestPage() {
  await requirePermissionPage('REQUEST_CREATE')
  const session = await getValidatedSession()
  if (!session) redirect("/login")
  const scope = await warehouseScopeIds()
  const [warehouses, products] = await Promise.all([
    db.warehouse.findMany({ where: { status: 'ACTIVE', id: { in: scope ?? undefined } }, select: { id: true, name: true } }),
    db.product.findMany({ 
      where: { status: 'ACTIVE' },
      select: { id: true, code: true, name: true, unitId: true, unit: { select: { id: true, code: true } } },
      orderBy: { name: 'asc' }
    })
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <RequestForm 
        warehouses={JSON.parse(JSON.stringify(warehouses))} 
        products={JSON.parse(JSON.stringify(products))}
        userId={session.userId}
        sessionExpiresAt={new Date(session.expiresAt).toISOString()}
      />
    </div>
  )
}
