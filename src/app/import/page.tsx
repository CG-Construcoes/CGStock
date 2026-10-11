import { db } from "@/lib/db"
import { requirePermissionPage } from "@/lib/permissions"
import { ImportClient } from "./import-client"

export const metadata = {
  title: "Importar Dados | CGStock",
}

export default async function ImportPage() {
  await requirePermissionPage('CONFIG_MANAGE')

  const warehouses = await db.warehouse.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true }
  })

  return <ImportClient warehouses={warehouses} />
}
