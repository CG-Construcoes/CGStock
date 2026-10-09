"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
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
  type LucideIcon
} from "lucide-react"

export function Sidebar({ user }: { user?: { name: string; email: string; roles: string[]; permissions?: string[] } | null }) {
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
        { name: "Requisições", href: "/requests", icon: ClipboardList, perm: 'REQUEST_CREATE' }, // Also can check APPROVE/FULFILL if needed
        { name: "Devoluções", href: "/returns", icon: RotateCcw, perm: 'STOCK_ENTRY' },
      ]

  const inventarioItems = isRequesterOnly ? [] : [
    { name: "Inventários", href: "/inventory", icon: ClipboardList, perm: 'INVENTORY_CREATE' }, // Or COUNT/REVIEW
    { name: "Coletor", href: "/collector", icon: CheckSquare, perm: 'INVENTORY_COUNT' },
  ]

  const maisItems = isRequesterOnly ? [] : [
    { name: "Importar", href: "/import", icon: FolderSync, perm: 'REPORT_EXPORT' },
    { name: "Exportar", href: "/export", icon: FolderSync, perm: 'REPORT_EXPORT' },
    { name: "Relatórios", href: "/reports", icon: BarChart3, perm: 'REPORT_VIEW' },
    { name: "API / Conectores", href: "/api", icon: Settings, perm: 'CONFIG_MANAGE' },
    { name: "Central de Ajuda", href: "/help", icon: HelpCircle },
    { name: "Gestão Central", href: "/admin", icon: Shield, perm: 'CONFIG_MANAGE' },
    { name: "Usuários", href: "/admin/users", icon: Users, perm: 'USER_VIEW' },
    { name: "Configurações", href: "/admin/settings", icon: Settings, perm: 'CONFIG_MANAGE' },
  ]

  const renderItem = (item: { name: string; href: string; icon: LucideIcon; perm?: string }) => {
    const isActive = pathname === item.href || (item.href !== '/' && item.href !== '/dashboard' && item.href !== '/admin' && item.href !== '#' && pathname.startsWith(item.href))
    
    let allowed = true
    if (item.perm && !isAdmin) {
      if (item.name === "Inventários") {
        allowed = hasPerm('INVENTORY_CREATE') || hasPerm('INVENTORY_COUNT') || hasPerm('INVENTORY_REVIEW') || hasPerm('INVENTORY_APPROVE')
      } else if (item.name === "Requisições") {
        allowed = hasPerm('REQUEST_CREATE') || hasPerm('REQUEST_APPROVE') || hasPerm('REQUEST_FULFILL')
      } else if (item.name === "Gestão Central") {
        allowed = hasPerm('CONFIG_MANAGE') || hasPerm('USER_VIEW')
      } else {
        allowed = hasPerm(item.perm)
      }
    }

    if (!allowed) {
      return (
        <li key={item.name} title="Você não possui permissão para acessar esta função.">
          <div
            className={cn(
              "group flex items-center gap-3 px-3 py-2.5 text-sm font-medium border-l-2 border-transparent transition-colors",
              "text-[#FDEFD6]/40 cursor-not-allowed"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0 text-[#C9832B]/40" />
            {item.name}
          </div>
        </li>
      )
    }

    return (
      <li key={item.name}>
        <Link
          href={item.href}
          className={cn(
            "group flex items-center gap-3 px-3 py-2.5 text-sm font-medium border-l-2 transition-colors",
            isActive 
              ? "border-[#E5A94F] text-[#FDEFD6] bg-[#5C3310]/40" 
              : "border-transparent text-[#FDEFD6] hover:bg-[#5C3310]/30 hover:text-[#E5A94F]"
          )}
        >
          <item.icon className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive ? "text-[#E5A94F]" : "text-[#C9832B] group-hover:text-[#E5A94F]"
          )} />
          {item.name}
        </Link>
      </li>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-[#5C3310] bg-[#000000]">
      <div className="flex h-16 items-center border-b border-[#5C3310] px-5 shrink-0">
        <div className="flex items-center gap-2 font-bold text-xl text-[#E5A94F] tracking-tight">
          <Package className="h-5 w-5 text-[#E5A94F]" />
          CGSTOCK
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <nav className="space-y-6 px-2">
          
          <ul className="space-y-0.5">
            {mainItems.map(renderItem)}
          </ul>

          {estoqueItems.length > 0 && (
            <div>
              <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-[#E5A94F]">Estoque</h3>
              <ul className="space-y-0.5">{estoqueItems.map(renderItem)}</ul>
            </div>
          )}

          {operacoesItems.length > 0 && (
            <div>
              <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-[#E5A94F]">Operações</h3>
              <ul className="space-y-0.5">{operacoesItems.map(renderItem)}</ul>
            </div>
          )}

          {inventarioItems.length > 0 && (
            <div>
              <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-[#E5A94F]">Inventário</h3>
              <ul className="space-y-0.5">{inventarioItems.map(renderItem)}</ul>
            </div>
          )}

          {maisItems.length > 0 && (
            <div>
              <button 
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-[#E5A94F] hover:bg-[#5C3310]/20 rounded-md transition-colors"
              >
                <span>Mais</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", isMoreOpen && "rotate-180")} />
              </button>
              
              {isMoreOpen && (
                <ul className="space-y-0.5 mt-2">{maisItems.map(renderItem)}</ul>
              )}
            </div>
          )}

        </nav>
      </div>
    </aside>
  )
}
