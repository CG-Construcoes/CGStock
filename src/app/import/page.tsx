import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import { requirePermissionPage } from "@/lib/permissions"
import { ImportClient } from "./import-client"

export const metadata = {
  title: "Importar Dados | CGStock",
}

export default async function ImportPage() {
  await requirePermissionPage('CONFIG_MANAGE')

  const scope = await warehouseScopeIds()
  const warehouses = await db.warehouse.findMany({
    where: { status: 'ACTIVE', id: { in: scope ?? undefined } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true }
  })

  return <ImportClient warehouses={warehouses} />
}
