"use client"
import { Suspense, useState } from "react"
import { Bell, Download, Menu, Package, Search } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { logoutAction } from "@/app/auth-actions"
import { clearOfflineSnapshots } from "@/lib/offline-snapshot"
import { toast } from "sonner"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { WarehouseSelectFilter, type WarehouseOption } from "@/components/ui/warehouse-select-filter"

export function Topbar({
  user,
  warehouses = [],
  activeWarehouseId = "",
}: {
  user?: { userId: string; name: string; email: string; roles: string[]; permissions?: string[] } | null
  warehouses?: WarehouseOption[]
  activeWarehouseId?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const logout = async () => {
    if (!user) return
    try {
      await clearOfflineSnapshots(user.userId)
    } catch {
      toast.warning('Dados locais não puderam ser limpos neste aparelho.')
    }
    await logoutAction()
  }

  const titleMap: Record<string, string> = {
    'new': 'Novo',
    'edit': 'Editar',
    'dashboard': 'Painel Geral',
    'users': 'Usuários',
    'products': 'Produtos',
    'stock': 'Estoque e Saldos',
    'categories': 'Categorias',
    'units': 'Unidades',
    'warehouses': 'Almoxarifados',
    'suppliers': 'Fornecedores',
    'locations': 'Localizações',
    'movements': 'Movimentações',
    'receipts': 'Entradas',
    'issues': 'Saídas',
    'quick-issue': 'Entrega Rápida',
    'adjustments': 'Ajuste Manual',
    'requests': 'Requisições',
    'fulfillment': 'Atender Requisição',
    'returns': 'Devoluções',
    'transfers': 'Transferências',
    'inventory': 'Inventários',
    'divergences': 'Divergências',
    'collector': 'Coletor',
    'import': 'Importar',
    'export': 'Exportar',
    'reports': 'Relatórios',
    'api': 'API / Conectores',
    'admin': 'Gestão Central',
    'settings': 'Configurações',
    'permissions': 'Permissões',
    'audit': 'Auditoria',
    'system': 'Sistema',
    'print-badges': 'Imprimir Crachás',
    'notifications': 'Notificações',
    'help': 'Central de Ajuda',
    'search': 'Busca',
    'change-password': 'Trocar Senha',
  }

  // Títulos mais claros para telas de cadastro ("Nova Entrada" em vez de "Novo")
  const newTitleMap: Record<string, string> = {
    'products': 'Novo Produto',
    'categories': 'Nova Categoria',
    'units': 'Nova Unidade',
    'locations': 'Nova Localização',
    'suppliers': 'Novo Fornecedor',
    'warehouses': 'Novo Almoxarifado',
    'receipts': 'Nova Entrada',
    'requests': 'Nova Requisição',
    'returns': 'Nova Devolução',
    'transfers': 'Nova Transferência',
    'inventory': 'Novo Inventário',
    'adjustments': 'Ajuste Manual',
    'users': 'Novo Usuário',
  }

  const segments = pathname.split('/').filter(Boolean)
  let lastSegment = segments[segments.length - 1] || 'dashboard'
  
  // Se o último segmento não estiver mapeado (ex: um ID/UUID), procuramos o último segmento válido
  if (!titleMap[lastSegment] && segments.length > 1) {
    const validSegment = [...segments].reverse().find(seg => titleMap[seg])
    if (validSegment) {
      lastSegment = validSegment
    }
  }

  const parentSegment = segments[segments.length - 2]
  let mappedTitle = titleMap[lastSegment] || lastSegment.replace(/-/g, ' ')
  if (lastSegment === 'new' && parentSegment && newTitleMap[parentSegment]) {
    mappedTitle = newTitleMap[parentSegment]
  } else if (lastSegment === 'edit') {
    const entity = [...segments].reverse().find(seg => seg !== 'edit' && titleMap[seg])
    if (entity) mappedTitle = `Editar ${titleMap[entity]}`
  }
  const titleFormatted = mappedTitle.charAt(0).toUpperCase() + mappedTitle.slice(1)

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)

  return (
    <header className="print-hidden sticky top-0 z-30 flex box-content h-14 sm:h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 pt-[env(safe-area-inset-top)] sm:px-6 shadow-sm shadow-black/5 backdrop-blur-md">
      
      {/* Left side: Hamburger button + Title (+ almoxarifado no celular) */}
      {!isMobileSearchOpen && (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden sm:flex-none sm:gap-3">
          <button
            type="button"
            className="lg:hidden p-2 -ml-1 text-foreground hover:bg-muted active:bg-muted rounded-md shrink-0 flex items-center justify-center"
            onClick={() => window.dispatchEvent(new Event("cgstock:open-menu"))}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight tracking-tight text-foreground sm:text-xl">
              {titleFormatted}
            </h1>
            {user && warehouses.length > 0 && (
              <div className="sm:hidden">
                <Suspense fallback={null}>
                  <WarehouseSelectFilter
                    warehouses={warehouses}
                    selectedWarehouseId={activeWarehouseId}
                    syncGlobalCookie={true}
                    allLabel="Todos os Almoxarifados"
                    appearance="inline"
                  />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Search Bar (Expanded) */}
      {isMobileSearchOpen && (
        <form 
          role="search"
          className="flex flex-1 items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200"
          onSubmit={(e) => {
            e.preventDefault()
            const q = String(new FormData(e.currentTarget).get('q') || '').trim()
            if (q) {
              router.push(`/search?q=${encodeURIComponent(q)}`)
              setIsMobileSearchOpen(false)
            }
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="search" 
              name="q"
              autoFocus
              enterKeyHint="search"
              placeholder="Buscar produto, pedido..." 
              className="h-10 w-full rounded-xl border border-primary bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button 
            type="button"
            className="h-10 shrink-0 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
            onClick={() => setIsMobileSearchOpen(false)}
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Right side: Actions */}
      {!isMobileSearchOpen && (
        <div className="flex items-center gap-0.5 sm:gap-3 shrink-0">
          {/* Seletor Global de Almoxarifado (tablet/desktop) */}
          {user && warehouses.length > 0 && (
            <div className="hidden sm:block">
              <Suspense fallback={null}>
                <WarehouseSelectFilter
                  warehouses={warehouses}
                  selectedWarehouseId={activeWarehouseId}
                  syncGlobalCookie={true}
                  allLabel="Todos os Almoxarifados"
                  compact={true}
                  className="w-[210px] md:w-[230px]"
                />
              </Suspense>
            </div>
          )}
          
          {/* Search Toggle (Mobile) */}
          <button 
            type="button"
            className="sm:hidden flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted active:bg-muted transition-colors"
            onClick={() => setIsMobileSearchOpen(true)}
            aria-label="Buscar"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Search Bar (Desktop) */}
          <form 
            role="search"
            className="relative hidden sm:block"
            onSubmit={(e) => {
              e.preventDefault()
              const q = new FormData(e.currentTarget).get('q')
              if (q) {
                router.push(`/search?q=${encodeURIComponent(q as string)}`)
              }
            }}
          >
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              type="search" 
              name="q"
              placeholder="Busca global..." 
              className="h-9 w-48 lg:w-64 rounded-full border border-border bg-muted/50 pl-9 pr-4 text-sm focus:w-64 lg:focus:w-72 focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </form>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          
          <button type="button" onClick={() => window.dispatchEvent(new Event("cgstock:install-help"))} className="hidden sm:block p-2 text-foreground hover:bg-muted rounded-md transition-colors" aria-label="Como instalar o aplicativo" title="Instalar aplicativo">
            <Download className="h-5 w-5" />
          </button>
          <Link href="/notifications" aria-label="Notificações" title="Notificações" className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted active:bg-muted transition-colors sm:h-auto sm:w-auto sm:rounded-md sm:p-2">
            <Bell className="h-5 w-5" />
          </Link>

          {user && (
            <div className="hidden sm:flex items-center gap-2 sm:gap-3 sm:ml-2 sm:border-l sm:border-border sm:pl-4 pl-1">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-foreground leading-none">{user.name.split(' ').slice(0, 2).join(' ')}</p>
                <p className="text-xs text-muted-foreground mt-1 tracking-wide uppercase truncate max-w-[120px]">{user.roles[0] || 'Usuário'}</p>
              </div>
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm shadow-inner ring-2 ring-background shrink-0">
                {user.name.charAt(0)}
              </div>
              <button 
                onClick={() => void logout()}
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline ml-1 sm:ml-2"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
