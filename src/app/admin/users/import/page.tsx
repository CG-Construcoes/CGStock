import { requireAnyPermissionPage } from "@/lib/permissions"
import { ImportUsersClient } from "./import-client"

export const metadata = {
  title: "Importar Funcionários | CGStock",
}

export default async function ImportUsersPage() {
  await requireAnyPermissionPage('USER_MANAGE', 'CONFIG_MANAGE')

  return <ImportUsersClient />
}
