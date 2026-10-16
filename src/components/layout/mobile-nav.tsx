"use client"

import Link from "next/link"
import { Suspense, useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  ChevronRight,
  Download,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Search,
  Sun,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet } from "@/components/ui/sheet"
import { WarehouseSelectFilter, type WarehouseOption } from "@/components/ui/warehouse-select-filter"
import { logoutAction } from "@/app/auth-actions"
import { clearOfflineSnapshots } from "@/lib/offline-snapshot"
import {
  getBottomNavItems,
  getNavSections,
  getQuickActions,
  isNavItemActive,
  roleLabel,
  type NavUser,
} from "./nav-config"

type MobileNavProps = {
  user?: NavUser
  warehouses?: WarehouseOption[]
  activeWarehouseId?: string
}

/* -------------------------------------------------------------------------- */
/*                               Barra inferior                               */
/* -------------------------------------------------------------------------- */

/**
 * Barra de navegação fixa na parte de baixo da tela (somente celular/tablet).
 * Dá acesso direto às telas mais usadas, às ações rápidas e ao menu completo.
 */
export function MobileBottomNav({ user, warehouses = [], activeWarehouseId = "" }: MobileNavProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  // Fecha os painéis ao trocar de página
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setMenuOpen(false)
    setActionsOpen(false)
    setKeyboardOpen(false)
  }

  // Esconde a barra enquanto o teclado está aberto (digitação em campos)
  useEffect(() => {
    const isTextField = (el: EventTarget | null) => {
      if (!window.matchMedia("(pointer: coarse)").matches) return false
      if (!(el instanceof HTMLElement)) return false
      if (el instanceof HTMLTextAreaElement) return true
      if (el instanceof HTMLInputElement) {
        return !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color"].includes(el.type)
      }
      return el.isContentEditable
    }
    const onFocusIn = (e: FocusEvent) => setKeyboardOpen(isTextField(e.target))
    const onFocusOut = () => {
      // Espera o próximo foco para decidir (evita piscar ao trocar de campo)
      window.setTimeout(() => setKeyboardOpen(isTextField(document.activeElement)), 50)
    }
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
    }
  }, [])

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeActions = useCallback(() => setActionsOpen(false), [])

  useEffect(() => {
    const onOpenMenu = () => setMenuOpen(true)
    const onOpenActions = () => setActionsOpen(true)
    window.addEventListener("cgstock:open-menu", onOpenMenu)
    window.addEventListener("cgstock:open-actions", onOpenActions)
    return () => {
      window.removeEventListener("cgstock:open-menu", onOpenMenu)
      window.removeEventListener("cgstock:open-actions", onOpenActions)
    }
  }, [])

  if (!user) return null

  const items = getBottomNavItems(user)
  const quickActions = getQuickActions(user)
  const anyItemActive = items.some((i) => isNavItemActive(pathname, i.href))

  // Telas de tarefa em tela cheia (coletor) não mostram a barra
  const hideBar = /^\/collector\/[^/]+\/[^/]+/.test(pathname) || keyboardOpen

  const tabClass = (active: boolean) =>
    cn(
      "relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors active:scale-95",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    )

  const activeBar = <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-primary" aria-hidden="true" />

  const left = items.slice(0, 2)
  const right = items.slice(2)

  const centerAction = quickActions.length === 0 ? null : quickActions.length === 1 ? (
    <Link href={quickActions[0].href} className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-foreground">
      <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-card">
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </span>
      {quickActions[0].name.split(" ")[0]}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => setActionsOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={actionsOpen}
      className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-foreground"
    >
      <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-card transition-transform active:scale-90">
        <Plus className={cn("h-7 w-7 transition-transform", actionsOpen && "rotate-45")} strokeWidth={2.5} />
      </span>
      Ações
    </button>
  )

  const cells = [
    ...left.map((item) => {
      const active = isNavItemActive(pathname, item.href)
      return (
        <Link key={item.href} href={item.href} className={tabClass(active)} aria-current={active ? "page" : undefined}>
          {active && activeBar}
          <item.icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
          {item.name}
        </Link>
      )
    }),
    ...(centerAction ? [<div key="center" className="h-full">{centerAction}</div>] : []),
    ...right.map((item) => {
      const active = isNavItemActive(pathname, item.href)
      return (
        <Link key={item.href} href={item.href} className={tabClass(active)} aria-current={active ? "page" : undefined}>
          {active && activeBar}
          <item.icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
          {item.name}
        </Link>
      )
    }),
    <button
      key="menu"
      type="button"
      onClick={() => setMenuOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={menuOpen}
      className={tabClass(menuOpen || (!anyItemActive && !actionsOpen))}
    >
      {(menuOpen || !anyItemActive) && activeBar}
      <Menu className="h-6 w-6" />
      Menu
    </button>,
  ]

  return (
    <>
      {!hideBar && (
        <nav
          aria-label="Navegação rápida"
          className="print-hidden shrink-0 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)] backdrop-blur-md lg:hidden"
        >
          <div
            className="mx-auto grid h-16 max-w-xl"
            style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
          >
            {cells}
          </div>
        </nav>
      )}

      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        user={user}
        warehouses={warehouses}
        activeWarehouseId={activeWarehouseId}
      />

      <Sheet open={actionsOpen} onClose={closeActions} side="bottom" label="Ações rápidas">
        <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
          <span className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-2">
          <div>
            <h2 className="text-lg font-bold">O que você quer fazer?</h2>
            <p className="text-sm text-muted-foreground">Toque em uma opção para começar.</p>
          </div>
          <button
            type="button"
            onClick={closeActions}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div data-sheet-scroll className="overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <ul className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="flex h-full min-h-[120px] flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all active:scale-[0.97] active:bg-primary/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <action.icon className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold leading-tight">{action.name}</span>
                    <span className="mt-1 block text-xs leading-snug text-muted-foreground">{action.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Menu completo                               */
/* -------------------------------------------------------------------------- */

function MobileMenu({
  open,
  onClose,
  user,
  warehouses = [],
  activeWarehouseId = "",
}: MobileNavProps & { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const sections = getNavSections(user)
  const isDark = resolvedTheme === "dark"

  const logout = async () => {
    if (!user) return
    try {
      await clearOfflineSnapshots(user.userId)
    } catch {
      toast.warning("Dados locais não puderam ser limpos neste aparelho.")
    }
    await logoutAction()
  }

  return (
    <Sheet open={open} onClose={onClose} side="left" label="Menu principal">
      {/* Cabeçalho com usuário */}
      <div className="shrink-0 bg-[#2c001e] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#ffb597]">
            <Package className="h-5 w-5" />
            CGSTOCK
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/20"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {user && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e95420] text-lg font-black text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{user.name.split(" ").slice(0, 2).join(" ")}</p>
              <p className="mt-0.5 text-sm text-[#ffb597]">{roleLabel(user.roles)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Almoxarifado e busca */}
        <div className="space-y-3 border-b border-border p-4">
          {warehouses.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Almoxarifado em uso</p>
              <Suspense fallback={null}>
                <WarehouseSelectFilter
                  warehouses={warehouses}
                  selectedWarehouseId={activeWarehouseId}
                  syncGlobalCookie={true}
                  allLabel="Todos os Almoxarifados"
                  className="flex w-full [&_select]:h-11"
                />
              </Suspense>
            </div>
          )}
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              const q = String(new FormData(e.currentTarget).get("q") || "").trim()
              if (q) {
                router.push(`/search?q=${encodeURIComponent(q)}`)
                onClose()
              }
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              enterKeyHint="search"
              placeholder="Buscar produto, pedido, código..."
              className="h-11 w-full rounded-xl border border-border bg-muted/40 pl-10 pr-4 text-sm focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </form>
        </div>

        {/* Seções do menu */}
        <nav className="space-y-5 p-4" aria-label="Todas as telas">
          {sections.map((section) => (
            <div key={section.id}>
              {section.title && (
                <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {section.collapsible ? "Outras opções" : section.title}
                </h3>
              )}
              <ul className="overflow-hidden rounded-2xl border border-border bg-card">
                {section.items.map((item, index) => {
                  const active = isNavItemActive(pathname, item.href)
                  return (
                    <li key={item.href} className={cn(index > 0 && "border-t border-border")}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-[60px] items-center gap-3 px-3 py-2.5 transition-colors active:bg-muted",
                          active && "bg-primary/10"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-[15px] font-semibold leading-tight", active && "text-primary")}>
                            {item.name === "Dashboard" ? "Início" : item.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.description}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Rodapé: tema, instalar, sair */}
      <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-foreground active:bg-muted"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {isDark ? "Tema claro" : "Tema escuro"}
        </button>
        <button
          type="button"
          onClick={() => {
            onClose()
            window.dispatchEvent(new Event("cgstock:install-help"))
          }}
          className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-foreground active:bg-muted"
        >
          <Download className="h-5 w-5" />
          Instalar app
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-red-600 active:bg-red-500/10 dark:text-red-400"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </Sheet>
  )
}
