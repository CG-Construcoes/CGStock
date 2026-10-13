import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import InventoryForm from "./inventory-form"
import { requirePermissionPage } from "@/lib/permissions"

export default async function NewInventoryPage() {
  await requirePermissionPage('INVENTORY_CREATE')
  const scope = await warehouseScopeIds()
  const warehouses = await db.warehouse.findMany({
    where: { status: 'ACTIVE', id: { in: scope ?? undefined } },
    include: { locations: true }
  })
  
  const users = await db.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, roles: { select: { name: true } } }
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <InventoryForm 
        warehouses={warehouses} 
        users={users} 
      />
    </div>
  )
}
