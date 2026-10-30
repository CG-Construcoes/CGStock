"use client"

import { useCallback, useEffect, useState } from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { MobileBottomNav } from "./mobile-nav"
import { usePathname } from "next/navigation"
import type { WarehouseOption } from "@/components/ui/warehouse-select-filter"
import { useOnlineStatus } from "@/lib/use-online-status"
import { OfflineWorkspace } from "@/components/offline-workspace"
import { computeSnapshotExpiry, getOfflineSnapshot, saveOfflineSnapshot } from "@/lib/offline-snapshot"
import type { UserContextSnapshotData } from "@/lib/localdb"

const CLIENT_FORM_ROUTES = new Set([
  "/quick-issue",
  "/tool-loans",
  "/collector/sync",
  "/receipts/new",
  "/adjustments/new",
  "/transfers/new",
  "/returns/new",
  "/requests/new",
  "/inventory/new",
])

export function AppShellClient({
  children,
  user: propUser,
  warehouses: propWarehouses = [],
  activeWarehouseId: propActiveWarehouseId = "",
}: {
  children: React.ReactNode
  user?: { userId: string; name: string; email: string; roles: string[]; permissions?: string[] } | null
  warehouses?: WarehouseOption[]
  activeWarehouseId?: string
}) {
  const nextPathname = usePathname()
  const isOnline = useOnlineStatus()
  const [cachedContext, setCachedContext] = useState<UserContextSnapshotData | null>(null)
  const [offlineNav, setOfflineNav] = useState<{ pathname: string; search: string; active: boolean }>({
    pathname: nextPathname || "/dashboard",
    search: "",
    active: false,
  })

  const user = propUser ?? (cachedContext ? {
    userId: cachedContext.userId,
    name: cachedContext.name,
    email: cachedContext.email,
    roles: cachedContext.roles,
    permissions: cachedContext.permissions,
  } : null)

  const warehouses = propWarehouses.length > 0 ? propWarehouses : (cachedContext?.warehouses ?? [])
  const activeWarehouseId = propActiveWarehouseId || cachedContext?.activeWarehouseId || ""

  // Salva contexto do usuário no IndexedDB quando online e restaura se necessário quando offline
  useEffect(() => {
    if (propUser) {
      void saveOfflineSnapshot<UserContextSnapshotData>(
        "userContext",
        propUser.userId,
        {
          userId: propUser.userId,
          name: propUser.name,
          email: propUser.email,
          roles: propUser.roles,
          permissions: propUser.permissions ?? [],
          warehouses: propWarehouses.map((w) => ({ id: w.id, code: w.code || w.id, name: w.name })),
          activeWarehouseId: propActiveWarehouseId,
        },
        computeSnapshotExpiry()
      ).catch(() => {})
      try {
        localStorage.setItem("cgstock_last_user_id", propUser.userId)
      } catch {
        // Ignora erro de localStorage
      }
      return
    }
    try {
      const lastUserId = localStorage.getItem("cgstock_last_user_id")
      if (lastUserId) {
        void getOfflineSnapshot<UserContextSnapshotData>("userContext", lastUserId).then((snap) => {
          if (snap?.data) setCachedContext(snap.data)
        })
      }
    } catch {
      // Ignora
    }
  }, [propActiveWarehouseId, propUser, propWarehouses])

  // Sincroniza URL real do navegador ao entrar no modo offline (ex: quando Service Worker serve App Shell para outra rota)
  useEffect(() => {
    if (typeof window === "undefined") return
    const timer = window.setTimeout(() => {
      if (isOnline) {
        setOfflineNav({ pathname: nextPathname || window.location.pathname, search: window.location.search, active: false })
        return
      }
      const realPath = window.location.pathname || nextPathname || "/dashboard"
      const realSearch = window.location.search || ""
      const shellMismatch = realPath !== nextPathname
      setOfflineNav((prev) => ({
        pathname: prev.active ? prev.pathname : realPath,
        search: prev.active ? prev.search : realSearch,
        active: prev.active || shellMismatch,
      }))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isOnline, nextPathname])

  const navigateOffline = useCallback((href: string) => {
    if (typeof window === "undefined") return
    try {
      const url = new URL(href, window.location.origin)
      if (url.origin !== window.location.origin) return
      window.history.pushState(null, "", url.pathname + url.search)
      setOfflineNav({ pathname: url.pathname, search: url.search, active: true })
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })
    } catch {
      // URL inválida
    }
  }, [])

  // Intercepta cliques em links internos e eventos popstate/customizados enquanto offline
  useEffect(() => {
    if (isOnline) return

    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || anchor.target === "_blank") {
        return
      }
      try {
        const url = new URL(href, window.location.origin)
        if (url.origin !== window.location.origin) return
        e.preventDefault()
        e.stopPropagation()
        navigateOffline(url.pathname + url.search)
      } catch {
        // Ignora
      }
    }

    const onPopState = () => {
      setOfflineNav({
        pathname: window.location.pathname || "/dashboard",
        search: window.location.search || "",
        active: true,
      })
    }

    const onCustomNav = (e: Event) => {
      const detail = (e as CustomEvent<{ href?: string }>).detail
      if (detail?.href) navigateOffline(detail.href)
    }

    document.addEventListener("click", onClickCapture, true)
    window.addEventListener("popstate", onPopState)
    window.addEventListener("cgstock:offline-navigate", onCustomNav)
    return () => {
      document.removeEventListener("click", onClickCapture, true)
      window.removeEventListener("popstate", onPopState)
      window.removeEventListener("cgstock:offline-navigate", onCustomNav)
    }
  }, [isOnline, navigateOffline])

  const effectivePathname = !isOnline ? offlineNav.pathname : (nextPathname || "/dashboard")
  const isPrintPage = effectivePathname?.includes("/print-badges") || effectivePathname?.includes("/print-labels")

  if (effectivePathname === "/login" || isPrintPage) {
    return <>{children}</>
  }

  const isNativeClientFormRoute =
    CLIENT_FORM_ROUTES.has(effectivePathname) || /^\/collector(\/[^/]+\/[^/]+)?$/.test(effectivePathname)

  // Quando offline:
  // - Se o usuário já estava em um formulário cliente nativo (/quick-issue, /collector, /receipts/new, etc.)
  //   e não navegou para outra rota offline, mantém {children} montado para preservar o estado do formulário.
  // - Caso tenha navegado offline, ou reaberto o PWA offline, ou esteja em uma tela de consulta/listagem,
  //   renderiza o OfflineWorkspace alimentado diretamente pelo IndexedDB.
  const shouldRenderOfflineWorkspace =
    !isOnline && !!user && (offlineNav.active || !isNativeClientFormRoute)

  return (
    <div className="flex h-dvh overflow-hidden bg-background font-sans print:h-auto print:overflow-visible print:bg-white">
      <div className="hidden lg:block w-[260px] shrink-0 border-r border-[#5e2750] print:hidden">
        <Sidebar user={user} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 print:h-auto print:overflow-visible">
        <div className="print:hidden">
          <Topbar user={user} warehouses={warehouses} activeWarehouseId={activeWarehouseId} />
        </div>
        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain min-h-0 min-w-0 px-3 py-4 pb-6 sm:p-6 print:p-0 print:h-auto print:overflow-visible">
          <div className="mx-auto max-w-7xl min-w-0 print:max-w-none print:m-0">
            {shouldRenderOfflineWorkspace ? (
              <OfflineWorkspace
                userId={user.userId}
                userName={user.name}
                activeWarehouseId={activeWarehouseId}
                pathname={effectivePathname}
                search={offlineNav.search}
                onNavigate={navigateOffline}
              />
            ) : (
              children
            )}
          </div>
        </main>
        <div className="print:hidden">
          <MobileBottomNav user={user} warehouses={warehouses} activeWarehouseId={activeWarehouseId} />
        </div>
      </div>
    </div>
  )
}
