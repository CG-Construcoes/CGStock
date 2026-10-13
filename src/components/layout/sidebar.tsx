"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { logoutAction } from "@/app/auth-actions"
import { clearOfflineSnapshots } from "@/lib/offline-snapshot"
import {
  LayoutDashboard,
  Package,
  Tags,
  MapPin,
  ArrowRightLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  RotateCcw,
  CheckSquare,
  BarChart3,
  Users,
  Shield,
  Settings,
  FolderSync,
  HelpCircle,
  ChevronDown,
  Box,
  LogOut,
  type LucideIcon
} from "lucide-react"

export function Sidebar({ user }: { user?: { userId: string; name: string; email: string; roles: string[]; permissions?: string[] } | null }) {
  const pathname = usePathname()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const isRequesterOnly = user?.roles && 
    user.roles.includes('SOLICITANTE') && 
    !user.roles.some(r => ['ADMIN', 'GESTOR', 'ALMOXARIFE'].includes(r))

  const permissions = user?.permissions || []
  const isAdmin = user?.roles?.includes('ADMIN') || permissions.includes('ADMIN')

  const hasPerm = (key: string) => isAdmin || permissions.includes(key)

  const mainItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ]

  const estoqueItems = isRequesterOnly ? [] : [
    { name: "Produtos", href: "/products", icon: Package, perm: 'PRODUCT_VIEW' },
    { name: "Estoque e Saldos", href: "/stock", icon: Box, perm: 'STOCK_VIEW' },
    { name: "Categorias", href: "/categories", icon: Tags, perm: 'PRODUCT_VIEW' },
    { name: "Unidades", href: "/units", icon: Package, perm: 'PRODUCT_VIEW' },
    { name: "Localizações", href: "/locations", icon: MapPin, perm: 'STOCK_VIEW' },
  ]

  const operacoesItems = isRequesterOnly 
    ? [{ name: "Requisições", href: "/requests", icon: ClipboardList, perm: 'REQUEST_CREATE' }]
    : [
        { name: "Entradas", href: "/receipts", icon: ArrowDownToLine, perm: 'STOCK_ENTRY' },
        { name: "Saídas", href: "/issues", icon: ArrowUpFromLine, perm: 'STOCK_EXIT' },
        { name: "Movimentações", href: "/movements", icon: ArrowRightLeft, perm: 'STOCK_VIEW' },
        { name: "Entrega Rápida", href: "/quick-issue", icon: Shield, perm: 'STOCK_EXIT' },
        { name: "Ajuste Manual", href: "/adjustments/new", icon: ArrowRightLeft, perm: 'STOCK_ENTRY' },
        { name: "Requisições", href: "/requests", icon: ClipboardList, perm: 'REQUEST_CREATE' }, // Also can check APPROVE/FULFILL if needed
        { name: "Devoluções", href: "/returns", icon: RotateCcw, perm: 'STOCK_ENTRY' },
      ]

  const inventarioItems = isRequesterOnly ? [] : [
    { name: "Inventários", href: "/inventory", icon: ClipboardList, perm: 'INVENTORY_CREATE' }, // Or COUNT/REVIEW
    { name: "Coletor", href: "/collector", icon: CheckSquare, perm: 'INVENTORY_COUNT' },
  ]

  const maisItems = isRequesterOnly ? [] : [
    { name: "Importar", href: "/import", icon: FolderSync, perm: 'ADMIN_ONLY' },
    { name: "Exportar", href: "/export", icon: FolderSync, perm: 'REPORT_EXPORT' },
    { name: "Relatórios", href: "/reports", icon: BarChart3, perm: 'REPORT_VIEW' },
    { name: "API / Conectores", href: "/api", icon: Settings, perm: 'CONFIG_MANAGE' },
    { name: "Central de Ajuda", href: "/help", icon: HelpCircle },
    { name: "Gestão Central", href: "/admin", icon: Shield, perm: 'CONFIG_MANAGE' },
    { name: "Usuários", href: "/admin/users", icon: Users, perm: 'USER_VIEW' },
    { name: "Configurações", href: "/admin/settings", icon: Settings, perm: 'CONFIG_MANAGE' },
  ]

  const isAllowed = (item: { name: string; perm?: string }) => {
    if (!item.perm || isAdmin) return true
    if (item.name === "Inventários" || item.name === "Coletor") {
      return ['INVENTORY_CREATE', 'INVENTORY_COUNT', 'INVENTORY_REVIEW', 'INVENTORY_APPROVE'].some(hasPerm)
    }
    if (item.name === "Requisições") {
      return ['REQUEST_CREATE', 'REQUEST_APPROVE', 'REQUEST_FULFILL'].some(hasPerm)
    }
    if (item.name === "Gestão Central") return hasPerm('USER_VIEW')
    if (item.name === "Usuários") return hasPerm('USER_VIEW') || hasPerm('USER_MANAGE')
    return hasPerm(item.perm)
  }

  const visibleEstoqueItems = estoqueItems.filter(isAllowed)
  const visibleOperacoesItems = operacoesItems.filter(isAllowed)
  const visibleInventarioItems = inventarioItems.filter(isAllowed)
  const visibleMaisItems = maisItems.filter(isAllowed)

  const renderItem = (item: { name: string; href: string; icon: LucideIcon; perm?: string }) => {
    const isActive = pathname === item.href || (item.href !== '/' && item.href !== '/dashboard' && item.href !== '/admin' && item.href !== '#' && pathname.startsWith(item.href))

    return (
      <li key={item.name}>
        <Link
          href={item.href}
          className={cn(
            "group flex items-center gap-3 px-3 py-2.5 text-sm font-medium border-l-2 transition-colors",
            isActive 
              ? "border-[#e95420] text-white bg-[#5e2750]"
              : "border-transparent text-[#f6f5f4] hover:bg-[#5e2750]/30 hover:text-[#ffb597]"
          )}
        >
          <item.icon className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive ? "text-[#ffb597]" : "text-[#f49570] group-hover:text-[#ffb597]"
          )} />
          {item.name}
        </Link>
      </li>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-[#5e2750] bg-[#2c001e]">
      <div className="flex h-16 items-center border-b border-[#5e2750] px-5 shrink-0">
        <div className="flex items-center gap-2 font-bold text-xl text-[#ffb597] tracking-tight">
          <Package className="h-5 w-5 text-[#ffb597]" />
          CGSTOCK
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <nav className="space-y-6 px-2">
          
          <ul className="space-y-0.5">
            {mainItems.map(renderItem)}
          </ul>

          {visibleEstoqueItems.length > 0 && (
            <div>
              <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-[#ffb597]">Estoque</h3>
              <ul className="space-y-0.5">{visibleEstoqueItems.map(renderItem)}</ul>
            </div>
          )}

          {visibleOperacoesItems.length > 0 && (
            <div>
              <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-[#ffb597]">Operações</h3>
              <ul className="space-y-0.5">{visibleOperacoesItems.map(renderItem)}</ul>
            </div>
          )}

          {visibleInventarioItems.length > 0 && (
            <div>
              <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-[#ffb597]">Inventário</h3>
              <ul className="space-y-0.5">{visibleInventarioItems.map(renderItem)}</ul>
            </div>
          )}

          {visibleMaisItems.length > 0 && (
            <div>
              <button 
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-[#ffb597] hover:bg-[#5e2750]/20 rounded-md transition-colors"
              >
                <span>Mais</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", isMoreOpen && "rotate-180")} />
              </button>
              
              {isMoreOpen && (
                <ul className="space-y-0.5 mt-2">{visibleMaisItems.map(renderItem)}</ul>
              )}
            </div>
          )}

        </nav>
      </div>
      <button type="button" onClick={() => void (async () => { if (user?.userId) await clearOfflineSnapshots(user.userId).catch(() => undefined); await logoutAction() })()} className="flex items-center gap-3 border-t border-[#5e2750] px-5 py-4 text-sm text-white lg:hidden">
        <LogOut className="size-4" /> Sair
      </button>
    </aside>
  )
}
