import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { resolveWarehouseContext } from "@/lib/dal"
import { QuickIssueClient } from "./quick-issue-client"

export default async function QuickIssuePage() {
  // Only users with quick_issue permission (or Admin/Gestor who can manage everything) should access this
  // In a real scenario we might have 'QUICK_ISSUE_EXECUTE' permission, for now let's just use STOCK_EXIT or similar
  await requirePermissionPage('STOCK_EXIT')
  const session = await getValidatedSession()
  if (!session) redirect("/login")

  const { selectedWarehouseId } = await resolveWarehouseContext(undefined, session.userId)

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-zinc-950">
      <QuickIssueClient
        userId={session.userId}
        sessionExpiresAt={new Date(session.expiresAt).toISOString()}
        activeWarehouseId={selectedWarehouseId}
      />
    </div>
  )
}
