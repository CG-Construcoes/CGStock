import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, MapPin, Box } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { resolveWarehouseContext } from "@/lib/dal"
import { SearchInput } from "@/components/ui/search-input"
import { WarehouseSelectFilter } from "@/components/ui/warehouse-select-filter"
import { requirePermissionPage } from "@/lib/permissions"
import { Suspense } from "react"

export default async function LocationsPage(props: {
  searchParams?: Promise<{ q?: string; warehouseId?: string }>
}) {
  await requirePermissionPage('CONFIG_MANAGE')
  const resolvedParams = props?.searchParams ? await props.searchParams : {}
  const q = resolvedParams.q || ''
  const { warehouses, selectedWarehouseId, warehouseWhere } = await resolveWarehouseContext(resolvedParams.warehouseId)

  const locations = await db.warehouseLocation.findMany({
    where: {
      ...warehouseWhere,
      ...(q ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ]
      } : {})
    },
    include: { warehouse: true, _count: { select: { products: true } } },
    orderBy: { code: 'asc' }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Localizações</h2>
          <p className="text-muted-foreground">Estruture fisicamente o almoxarifado em setores, corredores e prateleiras.</p>
        </div>
        <Link href="/locations/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Local
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-md border border-border shadow-sm">
        <SearchInput placeholder="Buscar localização por código ou nome..." />
        {warehouses.length > 1 && (
          <Suspense fallback={null}>
            <WarehouseSelectFilter
              warehouses={warehouses}
              selectedWarehouseId={selectedWarehouseId}
              className="w-full sm:w-64"
            />
          </Suspense>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {locations.map(location => (
          <Card key={location.id} className="hover:border-blue-300  cursor-pointer group">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white ">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg mb-1">{location.code}</h3>
              <p className="text-sm font-medium text-foreground mb-1">{location.name}</p>
              <p className="text-xs text-muted-foreground mb-4">{location.warehouse.name}</p>
              
              <div className="w-full flex items-center justify-between border-t pt-4 mt-auto">
                <div className="flex items-center text-muted-foreground text-sm">
                  <Box className="h-4 w-4 mr-1.5" />
                  {location._count.products} produtos
                </div>
                <Badge variant={location.status === 'ACTIVE' ? 'success' : 'secondary'} className="text-[10px]">
                  {location.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
