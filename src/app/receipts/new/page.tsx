import { db } from "@/lib/db"
import { warehouseIdFilter, warehouseScopeIds } from "@/lib/dal"
import ReceiptForm from "./receipt-form"
import { hasPermission, requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"

export default async function NewReceiptPage() {
  await requirePermissionPage('STOCK_ENTRY')
  const session = (await getValidatedSession())!

  const [scope, wFilter, canCreateProduct] = await Promise.all([
    warehouseScopeIds(),
    warehouseIdFilter(),
    hasPermission('PRODUCT_CREATE'),
  ])
  const [suppliers, warehouses, products, locations, categories, units] = await Promise.all([
    db.supplier.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true, document: true }, orderBy: { name: 'asc' } }),
    db.warehouse.findMany({ where: { status: 'ACTIVE', id: { in: scope ?? undefined } }, select: { id: true, name: true } }),
    db.product.findMany({ where: { status: 'ACTIVE' }, select: { id: true, code: true, name: true, averageCost: true }, orderBy: { name: 'asc' } }),
    db.warehouseLocation.findMany({ where: { status: 'ACTIVE', ...wFilter }, select: { id: true, code: true, name: true, warehouseId: true } }),
    db.productCategory.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.productUnit.findMany({ where: { status: 'ACTIVE' }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
  ])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <ReceiptForm 
        userId={session.userId}
        sessionExpiresAt={new Date(session.expiresAt).toISOString()}
        suppliers={suppliers} 
        warehouses={warehouses} 
        products={products.map(p => ({ ...p, averageCost: p.averageCost ? Number(p.averageCost) : null }))}
        locations={locations}
        categories={categories}
        units={units}
        canCreateProduct={canCreateProduct}
      />
    </div>
  )
}
