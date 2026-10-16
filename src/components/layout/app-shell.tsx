import { getValidatedSession } from "@/lib/auth"
import { getUserSecurityContext } from "@/lib/user-context"
import { getAccessibleWarehouses, getActiveWarehouseId, type AccessibleWarehouse } from "@/lib/dal"
import { AppShellClient } from "./app-shell-client"
import { SyncProvider } from "@/components/sync-provider"

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getValidatedSession()
  let permissions: string[] = []
  let warehouses: AccessibleWarehouse[] = []
  let activeWarehouseId = ""

  if (session) {
    if (session.roles.includes("ADMIN")) {
      permissions = ["ADMIN"]
    } else {
      const ctx = await getUserSecurityContext(session.userId)
      if (ctx) {
        permissions = Array.from(ctx.permissionKeys)
      }
    }

    const [whList, activeWhId] = await Promise.all([
      getAccessibleWarehouses(session.userId),
      getActiveWarehouseId(session.userId),
    ])
    warehouses = whList
    activeWarehouseId = activeWhId
  }

  return (
    <SyncProvider userId={session?.userId ?? null}>
      <AppShellClient
        user={session ? { ...session, permissions } : null}
        warehouses={warehouses}
        activeWarehouseId={activeWarehouseId}
      >
        {children}
      </AppShellClient>
    </SyncProvider>
  )
}
