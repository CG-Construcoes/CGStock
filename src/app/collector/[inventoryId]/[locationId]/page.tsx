import { db } from "@/lib/db"
import { warehouseIdFilter } from "@/lib/dal"
import { notFound } from "next/navigation"
import CollectorForm from "./collector-form"
import { requireAnyPermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"

export default async function CollectorLocationPage({ 
  params 
}: { 
  params: Promise<{ inventoryId: string, locationId: string }> 
}) {
  await requireAnyPermissionPage('INVENTORY_COUNT', 'INVENTORY_CREATE', 'INVENTORY_REVIEW', 'INVENTORY_APPROVE')
  const session = (await getValidatedSession())!
  const { inventoryId, locationId } = await params
  
  const inv = await db.inventory.findFirst({
    where: { id: inventoryId, ...await warehouseIdFilter(), locations: { some: { locationId } } }
  })

  const loc = await db.warehouseLocation.findFirst({
    where: { id: locationId, warehouseId: inv?.warehouseId ?? '' }
  })

  if (!inv || !loc) notFound()

  // Buscar todos os produtos ativos para permitir bipar qualquer um
  const products = await db.product.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, code: true, name: true, barcode: true }
  })

  return (
    <div className="min-h-screen bg-accent font-sans max-w-lg mx-auto">
      <CollectorForm 
        userId={session.userId}
        sessionExpiresAt={new Date(session.expiresAt).toISOString()}
        inventoryId={inv.id} 
        locationId={loc.id} 
        locationCode={loc.code} 
        products={products}
      />
    </div>
  )
}
