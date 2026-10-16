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
  Box,
  AlertTriangle,
  Ruler,
  Zap,
  SlidersHorizontal,
  FileDown,
  Plug,
  PackagePlus,
  PackageMinus,
  ClipboardPlus,
  ScanLine,
  Undo2,
  Search,
  HardHat,
  type LucideIcon,
} from "lucide-react"

export type NavUser = {
  userId: string
  name: string
  email: string
  roles: string[]
  permissions?: string[]
} | null | undefined

export type NavItem = {
  name: string
  href: string
  icon: LucideIcon
  /** Explicação curta em linguagem simples, exibida no menu do celular. */
  description: string
  perm?: string
}

export type NavSection = {
  id: string
  title: string
  items: NavItem[]
  /** Seção recolhível (ex.: "Mais"). */
  collapsible?: boolean
}

export type QuickAction = {
  name: string
  href: string
  icon: LucideIcon
  description: string
  perm?: string
  /** Lista de permissões alternativas (basta ter uma). */
  anyPerm?: string[]
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  ALMOXARIFE: "Almoxarife",
  CONFERENTE: "Conferente",
  SOLICITANTE: "Solicitante",
}

export function roleLabel(roles?: string[]) {
  const role = roles?.[0]
  if (!role) return "Usuário"
  return ROLE_LABELS[role] ?? role.charAt(0) + role.slice(1).toLowerCase()
}

export function isRequesterOnly(user: NavUser) {
  return !!user?.roles &&
    user.roles.includes("SOLICITANTE") &&
    !user.roles.some((r) => ["ADMIN", "GESTOR", "ALMOXARIFE"].includes(r))
}

/** Cria um verificador de permissão para itens de menu. */
export function createAccess(user: NavUser) {
  const permissions = user?.permissions || []
  const isAdmin = !!user?.roles?.includes("ADMIN") || permissions.includes("ADMIN")
  const hasPerm = (key: string) => isAdmin || permissions.includes(key)

  const isAllowed = (item: { name: string; perm?: string; anyPerm?: string[] }) => {
    if (isAdmin) return true
    if (item.anyPerm) return item.anyPerm.some(hasPerm)
    if (!item.perm) return true
    if (item.name === "Inventários" || item.name === "Coletor" || item.name === "Divergências") {
      return ["INVENTORY_CREATE", "INVENTORY_COUNT", "INVENTORY_REVIEW", "INVENTORY_APPROVE"].some(hasPerm)
    }
    if (item.name === "Requisições") {
      return ["REQUEST_CREATE", "REQUEST_APPROVE", "REQUEST_FULFILL"].some(hasPerm)
    }
    if (item.name === "Gestão Central") return hasPerm("USER_VIEW")
    if (item.name === "Usuários") return hasPerm("USER_VIEW") || hasPerm("USER_MANAGE")
    if (item.name === "Funcionários") return hasPerm("USER_VIEW") || hasPerm("USER_MANAGE") || hasPerm("STOCK_EXIT")
    return hasPerm(item.perm)
  }

  return { isAdmin, hasPerm, isAllowed }
}

const DASHBOARD: NavItem = {
  name: "Dashboard",
  href: "/dashboard",
  icon: LayoutDashboard,
  description: "Resumo geral do estoque",
}

const REQUESTS: NavItem = {
  name: "Requisições",
  href: "/requests",
  icon: ClipboardList,
  description: "Pedidos de material",
  perm: "REQUEST_CREATE",
}

/** Seções do menu, já filtradas pelas permissões do usuário. */
export function getNavSections(user: NavUser): NavSection[] {
  const requester = isRequesterOnly(user)
  const { isAllowed } = createAccess(user)

  const sections: NavSection[] = [
    { id: "main", title: "", items: [DASHBOARD] },
    {
      id: "estoque",
      title: "Estoque",
      items: requester ? [] : [
        { name: "Produtos", href: "/products", icon: Package, description: "Cadastro dos itens", perm: "PRODUCT_VIEW" },
        { name: "Estoque e Saldos", href: "/stock", icon: Box, description: "Quanto tem de cada item", perm: "STOCK_VIEW" },
        { name: "Categorias", href: "/categories", icon: Tags, description: "Grupos de produtos", perm: "PRODUCT_VIEW" },
        { name: "Unidades", href: "/units", icon: Ruler, description: "Un, Kg, Caixa, Litro...", perm: "PRODUCT_VIEW" },
        { name: "Localizações", href: "/locations", icon: MapPin, description: "Onde cada item fica guardado", perm: "STOCK_VIEW" },
      ],
    },
    {
      id: "operacoes",
      title: "Operações",
      items: requester ? [REQUESTS] : [
        { name: "Entradas", href: "/receipts", icon: ArrowDownToLine, description: "Registrar o que chegou", perm: "STOCK_ENTRY" },
        { name: "Saídas", href: "/issues", icon: ArrowUpFromLine, description: "Histórico do que saiu", perm: "STOCK_EXIT" },
        { name: "Movimentações", href: "/movements", icon: ArrowRightLeft, description: "Tudo o que entrou e saiu", perm: "STOCK_VIEW" },
        { name: "Registrar Saída", href: "/quick-issue", icon: Zap, description: "Saída rápida de material para alguém", perm: "STOCK_EXIT" },
        { name: "Ajuste Manual", href: "/adjustments/new", icon: SlidersHorizontal, description: "Corrigir uma quantidade", perm: "STOCK_ENTRY" },
        REQUESTS,
        { name: "Devoluções", href: "/returns", icon: RotateCcw, description: "Itens que voltaram ao estoque", perm: "STOCK_ENTRY" },
      ],
    },
    {
      id: "inventario",
      title: "Inventário",
      items: requester ? [] : [
        { name: "Inventários", href: "/inventory", icon: ClipboardList, description: "Contagem geral do estoque", perm: "INVENTORY_CREATE" },
        { name: "Divergências", href: "/divergences", icon: AlertTriangle, description: "Diferenças achadas na contagem", perm: "INVENTORY_REVIEW" },
        { name: "Coletor", href: "/collector", icon: CheckSquare, description: "Contar itens pelo celular", perm: "INVENTORY_COUNT" },
      ],
    },
    {
      id: "mais",
      title: "Mais",
      collapsible: true,
      items: requester
        ? [{ name: "Central de Ajuda", href: "/help", icon: HelpCircle, description: "Tire suas dúvidas" }]
        : [
            { name: "Funcionários", href: "/admin/employees", icon: HardHat, description: "Equipe de campo e crachás para capacete", perm: "USER_VIEW" },
            { name: "Importar", href: "/import", icon: FolderSync, description: "Trazer dados de uma planilha", perm: "ADMIN_ONLY" },
            { name: "Exportar", href: "/export", icon: FileDown, description: "Baixar dados em planilha", perm: "REPORT_EXPORT" },
            { name: "Relatórios", href: "/reports", icon: BarChart3, description: "Listas e gráficos para imprimir", perm: "REPORT_VIEW" },
            { name: "API / Conectores", href: "/api", icon: Plug, description: "Ligação com outros sistemas", perm: "CONFIG_MANAGE" },
            { name: "Central de Ajuda", href: "/help", icon: HelpCircle, description: "Tire suas dúvidas" },
            { name: "Gestão Central", href: "/admin", icon: Shield, description: "Administração do sistema", perm: "CONFIG_MANAGE" },
            { name: "Usuários", href: "/admin/users", icon: Users, description: "Quem pode acessar o sistema", perm: "USER_VIEW" },
            { name: "Configurações", href: "/admin/settings", icon: Settings, description: "Preferências do sistema", perm: "CONFIG_MANAGE" },
          ],
    },
  ]

  return sections
    .map((s) => ({ ...s, items: s.items.filter(isAllowed) }))
    .filter((s) => s.items.length > 0)
}

/** Ações mais comuns do dia a dia, mostradas como botões grandes no celular. */
export function getQuickActions(user: NavUser): QuickAction[] {
  const requester = isRequesterOnly(user)
  const { isAllowed } = createAccess(user)

  const actions: QuickAction[] = requester
    ? [
        { name: "Pedir material", href: "/requests/new", icon: ClipboardPlus, description: "Fazer uma nova requisição", perm: "REQUEST_CREATE" },
        { name: "Meus pedidos", href: "/requests", icon: ClipboardList, description: "Acompanhar requisições", anyPerm: ["REQUEST_CREATE", "REQUEST_APPROVE", "REQUEST_FULFILL"] },
      ]
    : [
        { name: "Registrar saída", href: "/quick-issue", icon: PackageMinus, description: "Saída rápida para uma pessoa", perm: "STOCK_EXIT" },
        { name: "Registrar entrada", href: "/receipts/new", icon: PackagePlus, description: "Chegou material novo", perm: "STOCK_ENTRY" },
        { name: "Consultar estoque", href: "/stock", icon: Search, description: "Ver quanto tem de cada item", perm: "STOCK_VIEW" },
        { name: "Pedir material", href: "/requests/new", icon: ClipboardPlus, description: "Fazer uma requisição", perm: "REQUEST_CREATE" },
        { name: "Contar estoque", href: "/collector", icon: ScanLine, description: "Abrir o coletor de inventário", anyPerm: ["INVENTORY_COUNT", "INVENTORY_CREATE", "INVENTORY_REVIEW"] },
        { name: "Registrar devolução", href: "/returns/new", icon: Undo2, description: "Item voltou para o estoque", perm: "STOCK_ENTRY" },
      ]

  return actions.filter(isAllowed)
}

/** Itens fixos da barra inferior do celular (além de "Ações" e "Menu"). */
export function getBottomNavItems(user: NavUser): NavItem[] {
  const requester = isRequesterOnly(user)
  const { isAllowed } = createAccess(user)

  const home: NavItem = { ...DASHBOARD, name: "Início" }
  const candidates: NavItem[] = requester
    ? [
        { ...REQUESTS, name: "Pedidos" },
        { name: "Ajuda", href: "/help", icon: HelpCircle, description: "Tire suas dúvidas" },
      ]
    : [
        { name: "Estoque", href: "/stock", icon: Box, description: "Saldos", perm: "STOCK_VIEW" },
        { ...REQUESTS, name: "Pedidos" },
        { name: "Inventários", href: "/inventory", icon: ClipboardList, description: "Contagem", perm: "INVENTORY_CREATE" },
        { name: "Produtos", href: "/products", icon: Package, description: "Cadastro", perm: "PRODUCT_VIEW" },
        { name: "Ajuda", href: "/help", icon: HelpCircle, description: "Tire suas dúvidas" },
      ]

  // O nome usado para checar permissão precisa ser o original
  const allowed = candidates.filter((item) =>
    isAllowed({ ...item, name: item.name === "Pedidos" ? "Requisições" : item.name })
  )
  return [home, ...allowed.slice(0, 2)]
}

export function isNavItemActive(pathname: string, href: string) {
  if (pathname === href) return true
  if (href === "/" || href === "/dashboard" || href === "/admin" || href === "#") return false
  return pathname.startsWith(href + "/") || pathname.startsWith(href + "?")
}
