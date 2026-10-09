"use client"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { usePathname } from "next/navigation"

export function AppShellClient({
  children,
  user
}: {
  children: React.ReactNode,
  user?: { name: string; email: string; roles: string[]; permissions?: string[] } | null
}) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans">
      <div className="hidden lg:block w-[260px] shrink-0 border-r border-[#5C3310]">
        <Sidebar user={user} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto min-h-0 p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
