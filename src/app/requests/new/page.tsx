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
  const warehouses = await db.warehouse.findMany({ where: { status: 'ACTIVE', id: { in: scope ?? undefined } } })
  const products = await db.product.findMany({ 
    where: { status: 'ACTIVE' },
    include: { unit: true } 
  })

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
