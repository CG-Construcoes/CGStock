import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import { Card, CardContent } from "@/components/ui/card"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { TransferForm } from "./transfer-form"

export default async function NewTransferPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requirePermissionPage('STOCK_TRANSFER')
  const session = await getValidatedSession()
  if (!session) redirect("/login")
  const resolvedParams = await searchParams
  const error = resolvedParams?.error
  const scope = await warehouseScopeIds()
  const warehouses = await db.warehouse.findMany({ 
    where: { status: 'ACTIVE', id: { in: scope ?? undefined } },
    include: { locations: true }
  })
  
  const products = await db.product.findMany({ 
    where: { status: 'ACTIVE' },
    include: { unit: true }
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Transferência</h2>
          <p className="text-muted-foreground">Mova materiais entre diferentes localizações ou estoques.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <TransferForm
            warehouses={JSON.parse(JSON.stringify(warehouses))}
            products={JSON.parse(JSON.stringify(products))}
            userId={session.userId}
            sessionExpiresAt={new Date(session.expiresAt).toISOString()}
            error={error}
          />
        </CardContent>
      </Card>
    </div>
  )
}
