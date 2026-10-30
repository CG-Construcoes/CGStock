import { db } from "@/lib/db"
import { requireAnyPermissionPage } from "@/lib/permissions"
import { EmployeeImportClient } from "./import-client"

export const metadata = {
  title: "Importar Funcionários de Campo - CGStock",
}

export default async function EmployeeImportPage() {
  await requireAnyPermissionPage("USER_MANAGE", "CONFIG_MANAGE", "PRODUCT_CREATE", "STOCK_EXIT")

  const warehouses = await db.warehouse.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })

  return <EmployeeImportClient warehouses={warehouses} />
}
