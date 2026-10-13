import { getValidatedSession } from "@/lib/auth"
import { getUserSecurityContext } from "@/lib/user-context"
import { AppShellClient } from "./app-shell-client"
import { SyncProvider } from "@/components/sync-provider"

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getValidatedSession()
  let permissions: string[] = []

  if (session) {
    if (session.roles.includes("ADMIN")) {
      permissions = ["ADMIN"]
    } else {
      const ctx = await getUserSecurityContext(session.userId)
      if (ctx) {
        permissions = Array.from(ctx.permissionKeys)
      }
    }
  }

  const shell = <AppShellClient user={session ? { ...session, permissions } : null}>{children}</AppShellClient>
  return session ? <SyncProvider userId={session.userId}>{shell}</SyncProvider> : shell
}
