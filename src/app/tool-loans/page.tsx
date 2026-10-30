import { redirect } from "next/navigation"
import { getValidatedSession } from "@/lib/auth"
import { hasAnyPermission } from "@/lib/permissions"
import { listOpenToolLoans } from "./actions"
import { ToolLoansClient } from "./tool-loans-client"

export default async function ToolLoansPage() {
  const session = await getValidatedSession()
  if (!session) redirect("/login")

  const allowed = await hasAnyPermission("STOCK_EXIT", "STOCK_ENTRY")
  if (!allowed) redirect("/unauthorized")

  const { summaries, activeWarehouseName } = await listOpenToolLoans()

  return (
    <div className="max-w-4xl mx-auto">
      <ToolLoansClient
        initialSummaries={summaries}
        initialWarehouseName={activeWarehouseName}
      />
    </div>
  )
}
