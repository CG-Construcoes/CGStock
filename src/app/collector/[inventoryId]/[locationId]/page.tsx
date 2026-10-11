import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import CollectorForm from "./collector-form"
import { requireAnyPermissionPage } from "@/lib/permissions"

export default async function CollectorLocationPage({ 
  params 
}: { 
  params: Promise<{ inventoryId: string, locationId: string }> 
}) {
  await requireAnyPermissionPage('INVENTORY_COUNT', 'INVENTORY_CREATE', 'INVENTORY_REVIEW', 'INVENTORY_APPROVE')
  const { inventoryId, locationId } = await params
  
  const inv = await db.inventory.findUnique({
    where: { id: inventoryId }
  })

  const loc = await db.warehouseLocation.findUnique({
    where: { id: locationId }
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
        inventoryId={inv.id} 
        locationId={loc.id} 
        locationCode={loc.code} 
        products={products}
      />
    </div>
  )
}
