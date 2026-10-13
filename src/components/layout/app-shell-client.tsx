"use client"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { usePathname } from "next/navigation"

export function AppShellClient({
  children,
  user
}: {
  children: React.ReactNode,
  user?: { userId: string; name: string; email: string; roles: string[]; permissions?: string[] } | null
}) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background font-sans">
      <div className="hidden lg:block w-[260px] shrink-0 border-r border-[#5e2750]">
        <Sidebar user={user} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto min-h-0 min-w-0 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="mx-auto max-w-7xl min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
