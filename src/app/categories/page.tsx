import { db } from "@/lib/db"
import { hasPermission, requirePermissionPage } from "@/lib/permissions"
import { CategoriesClient } from "./categories-client"

export default async function CategoriesPage() {
  await requirePermissionPage('PRODUCT_VIEW')
  const [categories, canCreate, canUpdate] = await Promise.all([
    db.productCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } }
    }),
    hasPermission('PRODUCT_CREATE'),
    hasPermission('PRODUCT_UPDATE'),
  ])

  return (
    <CategoriesClient
      canCreate={canCreate}
      canUpdate={canUpdate}
      categories={categories.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        status: c.status,
        productCount: c._count.products,
      }))}
    />
  )
}
