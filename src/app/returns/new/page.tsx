import { db } from "@/lib/db"
import { warehouseIdFilter, warehouseScopeIds } from "@/lib/dal"
import { Card, CardContent } from "@/components/ui/card"
import { BackButton } from "@/components/ui/back-button"
import { ReturnForm } from "./return-form"
import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function NewReturnPage() {
  await requirePermissionPage('STOCK_ENTRY')
  const session = await getValidatedSession()
  if (!session) redirect("/login")
  const scope = await warehouseScopeIds()
  const [warehouses, products, requests] = await Promise.all([
    db.warehouse.findMany({
      where: { status: 'ACTIVE', id: { in: scope ?? undefined } },
      include: { locations: true }
    }),
    db.product.findMany({
      where: { status: 'ACTIVE' },
      include: { unit: true }
    }),
    db.materialRequest.findMany({
      where: { status: { in: ['FULFILLED', 'PARTIALLY_FULFILLED'] }, ...await warehouseIdFilter() }
    })
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Devolução</h2>
          <p className="text-muted-foreground">Registre o retorno de materiais ao estoque.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <ReturnForm
            warehouses={JSON.parse(JSON.stringify(warehouses))}
            products={JSON.parse(JSON.stringify(products))}
            requests={JSON.parse(JSON.stringify(requests))}
            userId={session.userId}
            sessionExpiresAt={new Date(session.expiresAt).toISOString()}
          />
        </CardContent>
      </Card>
    </div>
  )
}
