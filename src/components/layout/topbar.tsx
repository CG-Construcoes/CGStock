"use client"
import { useState } from "react"
import { createPortal } from "react-dom"
import { Bell, Download, Menu, Search } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { logoutAction } from "@/app/auth-actions"
import { clearOfflineSnapshots } from "@/lib/offline-snapshot"
import { toast } from "sonner"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Sidebar } from "./sidebar"

export function Topbar({ user }: { user?: { userId: string; name: string; email: string; roles: string[]; permissions?: string[] } | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const logout = async () => {
    if (!user) return
    try {
      await clearOfflineSnapshots(user.userId)
    } catch {
      toast.warning('Dados locais não puderam ser limpos neste aparelho.')
    }
    await logoutAction()
  }

  // Fecha o menu mobile ao navegar (ajuste de estado durante render, padrão recomendado)
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setIsMobileMenuOpen(false)
  }
  
  const titleMap: Record<string, string> = {
    'new': 'Novo',
    'edit': 'Editar',
    'dashboard': 'Painel Geral',
    'users': 'Usuários',
    'products': 'Produtos',
    'categories': 'Categorias',
    'units': 'Unidades',
    'warehouses': 'Almoxarifados',
    'suppliers': 'Fornecedores',
    'locations': 'Localizações',
    'movements': 'Movimentações',
    'receipts': 'Entradas',
    'issues': 'Saídas',
    'requests': 'Requisições',
    'returns': 'Devoluções',
    'inventory': 'Auditorias',
    'collector': 'Coletor',
    'import': 'Importar',
    'export': 'Exportar',
    'reports': 'Relatórios',
    'api': 'API / Conectores',
    'admin': 'Gestão Central',
    'settings': 'Configurações',
    'notifications': 'Notificações',
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

  const mappedTitle = titleMap[lastSegment] || lastSegment.replace(/-/g, ' ')
  const titleFormatted = mappedTitle.charAt(0).toUpperCase() + mappedTitle.slice(1)

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-4 sm:px-6 shadow-sm shadow-black/5">
      
      {/* Left side: Hamburger and Title */}
      {!isMobileSearchOpen && (
        <div className="flex min-w-0 items-center gap-2 overflow-hidden sm:gap-3">
          <button 
            className="lg:hidden p-2 -ml-2 text-muted-foreground hover:bg-accent rounded-md shrink-0"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
            {titleFormatted}
          </h1>
        </div>
      )}

      {/* Mobile Search Bar (Expanded) */}
      {isMobileSearchOpen && (
        <form 
          className="flex-1 flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-right-4"
          onSubmit={(e) => {
            e.preventDefault()
            const q = new FormData(e.currentTarget).get('q')
            if (q) {
              router.push(`/search?q=${encodeURIComponent(q as string)}`)
              setIsMobileSearchOpen(false)
            }
          }}
        >
          <input 
            type="search" 
            name="q"
            autoFocus
            placeholder="Buscar..." 
            className="h-10 w-full rounded-md border border-primary bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button 
            type="button"
            className="p-2 text-muted-foreground hover:bg-muted rounded-md shrink-0"
            onClick={() => setIsMobileSearchOpen(false)}
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Right side: Actions */}
      {!isMobileSearchOpen && (
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          
          {/* Search Toggle (Mobile) */}
          <button 
            className="sm:hidden p-2 text-muted-foreground hover:bg-muted rounded-md transition-colors"
            onClick={() => setIsMobileSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Search Bar (Desktop) */}
          <form 
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
          
          <button type="button" onClick={() => window.dispatchEvent(new Event("cgstock:install-help"))} className="p-2 text-foreground hover:bg-muted rounded-md transition-colors" aria-label="Como instalar o aplicativo" title="Instalar aplicativo">
            <Download className="h-5 w-5" />
          </button>
          <Link href="/notifications" aria-label="Notificações" className="relative hidden sm:block p-2 text-foreground hover:bg-muted rounded-md transition-colors">
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

      {/* Mobile Sidebar Overlay via Portal */}
      {isMobileMenuOpen && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex lg:hidden">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in" 
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          ></div>
          <div className="relative flex w-[280px] max-w-[85vw] flex-1 flex-col bg-background shadow-2xl animate-in slide-in-from-left">
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute right-4 top-4 z-50 p-2 text-[#ffb597] bg-[#5e2750] rounded-md hover:bg-[#713864]"
              aria-label="Fechar menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <div className="flex-1 overflow-y-auto w-full h-full">
              <Sidebar user={user} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  )
}
