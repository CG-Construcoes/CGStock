import { ReactNode } from "react"
import { requirePermissionPage } from "@/lib/permissions"

export default async function ImportLayout({ children }: { children: ReactNode }) {
  await requirePermissionPage("CONFIG_MANAGE")
  return <>{children}</>
}
