import { db } from "@/lib/db"
import { requireAnyPermissionPage } from "@/lib/permissions"
import { EmployeeImportClient } from "./import-client"

export const metadata = {
  title: "Importar Funcionários de Campo - CGStock",
}

export default async function EmployeeImportPage() {
  await requireAnyPermissionPage("USER_MANAGE", "CONFIG_MANAGE")

  const worksites = await db.worksite.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })

  return <EmployeeImportClient worksites={worksites} />
}
