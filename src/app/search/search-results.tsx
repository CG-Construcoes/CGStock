import { db } from "@/lib/db"
import Link from "next/link"
import { Package, ArrowRightLeft, ClipboardList, MapPin, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { warehouseIdFilter } from "@/lib/dal"
import { getValidatedSession } from "@/lib/auth"

export async function SearchResults({ query }: { query: string }) {
  const session = await getValidatedSession()
  const wFilter = session ? await warehouseIdFilter(session.userId) : undefined

  const [products, requests, movements, locations] = await Promise.all([
    db.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { code: { contains: query, mode: "insensitive" } },
        ]
      },
      include: {
        category: true
      },
      take: 10,
    }),
    db.materialRequest.findMany({
      where: {
        requestNumber: { contains: query, mode: "insensitive" },
        ...wFilter
      },
      take: 10,
    }),
    db.stockMovement.findMany({
      where: {
        OR: [
          { documentNumber: { contains: query, mode: "insensitive" } },
          { reason: { contains: query, mode: "insensitive" } },
        ],
        ...wFilter
      },
      include: {
        product: true
      },
      take: 10,
    }),
    db.warehouseLocation.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { code: { contains: query, mode: "insensitive" } },
        ],
        ...wFilter
      },
      include: {
        warehouse: true
      },
      take: 10,
    })
  ])

  const totalResults = products.length + requests.length + movements.length + locations.length

  if (totalResults === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-md border border-border shadow-sm">
        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-4">
          <Search className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Nenhum resultado encontrado</h3>
        <p className="text-muted-foreground mt-1">
          Não conseguimos encontrar nada correspondente a &quot;{query}&quot;. Tente buscar por outros termos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {products.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Produtos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(product => (
              <Link key={product.id} href={`/products/${product.id}`} className="group p-4 bg-card rounded-md border border-border shadow-sm hover:border-primary/50 hover:shadow-sm  flex justify-between items-center">
                <div>
                  <p className="font-bold text-foreground group-hover:text-primary ">{product.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{product.code} • {product.category.name}</p>
                </div>
                <Badge variant={product.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {product.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-600" /> Requisições
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map(req => (
              <Link key={req.id} href={`/requests/${req.id}`} className="group p-4 bg-card rounded-md border border-border shadow-sm hover:border-emerald-500/50 hover:shadow-sm  flex justify-between items-center">
                <div>
                  <p className="font-bold text-foreground group-hover:text-emerald-600 ">{req.requestNumber}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(req.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <Badge variant="outline">{req.status}</Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {movements.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" /> Movimentações
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {movements.map(mov => (
              <Link key={mov.id} href={`/movements/${mov.id}`} className="group p-4 bg-card rounded-md border border-border shadow-sm hover:border-blue-500/50 hover:shadow-sm  flex justify-between items-center">
                <div>
                  <p className="font-bold text-foreground group-hover:text-blue-600 ">{mov.documentNumber || 'S/N'}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{mov.product.name} • {mov.type}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold font-mono">{Number(mov.quantity) > 0 ? '+' : ''}{Number(mov.quantity)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {locations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-amber-600" /> Localizações
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locations.map(loc => (
              <div key={loc.id} className="p-4 bg-card rounded-md border border-border shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-bold text-foreground">{loc.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{loc.code} • {loc.warehouse.name}</p>
                </div>
                <Badge variant="outline">{loc.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
