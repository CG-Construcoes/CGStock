import { getValidatedSession } from "@/lib/auth"
import { getUserSecurityContext } from "@/lib/user-context"
import { AppShellClient } from "./app-shell-client"

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

  return <AppShellClient user={session ? { ...session, permissions } : null}>{children}</AppShellClient>
}
