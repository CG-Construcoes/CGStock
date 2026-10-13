import { db } from "@/lib/db"
import { warehouseIdFilter, warehouseScopeIds } from "@/lib/dal"
import ReceiptForm from "./receipt-form"
import { requirePermissionPage } from "@/lib/permissions"

export default async function NewReceiptPage() {
  await requirePermissionPage('STOCK_ENTRY')

  const scope = await warehouseScopeIds()
  const suppliers = await db.supplier.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } })
  const warehouses = await db.warehouse.findMany({ where: { status: 'ACTIVE', id: { in: scope ?? undefined } } })
  const products = await db.product.findMany({ where: { status: 'ACTIVE' }, include: { unit: true } })
  const locations = await db.warehouseLocation.findMany({ where: { status: 'ACTIVE', ...await warehouseIdFilter() } })

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <ReceiptForm 
        suppliers={suppliers} 
        warehouses={warehouses} 
        products={products.map(p => ({ ...p, averageCost: p.averageCost ? Number(p.averageCost) : null }))}
        locations={locations} 
      />
    </div>
  )
}
