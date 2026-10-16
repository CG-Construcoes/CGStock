"use client"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { MobileBottomNav } from "./mobile-nav"
import { usePathname } from "next/navigation"
import type { WarehouseOption } from "@/components/ui/warehouse-select-filter"

export function AppShellClient({
  children,
  user,
  warehouses = [],
  activeWarehouseId = "",
}: {
  children: React.ReactNode,
  user?: { userId: string; name: string; email: string; roles: string[]; permissions?: string[] } | null
  warehouses?: WarehouseOption[]
  activeWarehouseId?: string
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
        <Topbar user={user} warehouses={warehouses} activeWarehouseId={activeWarehouseId} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain min-h-0 min-w-0 px-3 py-4 pb-6 sm:p-6">
          <div className="mx-auto max-w-7xl min-w-0">
            {children}
          </div>
        </main>
        <MobileBottomNav user={user} warehouses={warehouses} activeWarehouseId={activeWarehouseId} />
      </div>
    </div>
  )
}
