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

  // Buscar produtos ativos com a quantidade atual no sistema para esta localização
  const rawProducts = await db.product.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { stocks: { some: { warehouseId: inv.warehouseId } } },
        { defaultLocation: { warehouseId: inv.warehouseId } },
        { stocks: { none: {} } }
      ]
    },
    select: {
      id: true,
      code: true,
      name: true,
      barcode: true,
      unit: { select: { code: true } },
      stocks: {
        where: { warehouseId: inv.warehouseId },
        select: { locationId: true, quantity: true }
      }
    },
    orderBy: { name: 'asc' }
  })

  const products = rawProducts.map((p) => {
    const locStock = p.stocks.find((s) => s.locationId === loc.id)
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      barcode: p.barcode,
      unitCode: p.unit?.code || "UN",
      systemQuantity: locStock ? Number(locStock.quantity) : 0,
      locationStocks: Object.fromEntries(p.stocks.map((s) => [s.locationId, Number(s.quantity)])),
    }
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
