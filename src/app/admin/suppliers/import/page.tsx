import { requirePermissionPage } from "@/lib/permissions"
import { SupplierImportClient } from "./import-client"

export const metadata = {
  title: "Importar Fornecedores - CGStock",
}

export default async function SupplierImportPage() {
  await requirePermissionPage("CONFIG_MANAGE")
  return <SupplierImportClient />
}
