import { redirect } from "next/navigation"
import { getValidatedSession } from "@/lib/auth"
import { hasAnyPermission } from "@/lib/permissions"
import { listToolRoomData } from "./actions"
import { ToolLoansClient } from "./tool-loans-client"

export default async function ToolLoansPage() {
  const session = await getValidatedSession()
  if (!session) redirect("/login")

  const allowed = await hasAnyPermission("STOCK_EXIT", "STOCK_ENTRY")
  if (!allowed) redirect("/unauthorized")

  const data = await listToolRoomData()

  return (
    <div className="max-w-5xl mx-auto">
      <ToolLoansClient
        initialSummaries={data.summaries}
        initialTools={data.tools}
        initialWarehouses={data.warehouses}
        initialWarehouseId={data.activeWarehouseId}
        initialWarehouseName={data.activeWarehouseName}
      />
    </div>
  )
}
