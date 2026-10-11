import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, PackageOpen, Box } from "lucide-react"
import { db } from "@/lib/db"
import Link from "next/link"
import { requirePermissionPage } from "@/lib/permissions"

export default async function WarehousesPage() {
  await requirePermissionPage('CONFIG_MANAGE')
  const warehouses = await db.warehouse.findMany({
    include: { _count: { select: { locations: true, stocks: true } } },
    orderBy: { code: 'asc' }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Almoxarifados</h2>
          <p className="text-muted-foreground">Gerencie as unidades e galpões físicos da empresa.</p>
        </div>
        <Link href="/admin/warehouses/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Almoxarifado
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card  p-4 rounded-md border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar almoxarifado por código ou nome..." className="pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">Nenhum almoxarifado cadastrado.</div>
        )}
        {warehouses.map(warehouse => (
          <Link key={warehouse.id} href={`/admin/warehouses/${warehouse.id}`}>
            <Card className="hover:border-blue-300  cursor-pointer group h-full">
              <CardContent className="p-6 flex flex-col items-center text-center h-full">
                <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white ">
                  <PackageOpen className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-xl mb-1">{warehouse.name}</h3>
                <p className="text-sm font-medium text-foreground mb-1">{warehouse.code}</p>
                <p className="text-xs text-muted-foreground mb-6 line-clamp-2">{warehouse.description || "Sem descrição"}</p>
                
                <div className="w-full flex items-center justify-between border-t pt-4 mt-auto">
                  <div className="flex flex-col text-left">
                    <div className="flex items-center text-muted-foreground text-sm">
                      <Box className="h-4 w-4 mr-1.5" />
                      {warehouse._count.stocks} lotes
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {warehouse._count.locations} localizações
                    </div>
                  </div>
                  <Badge variant={warehouse.status === 'ACTIVE' ? 'success' : 'secondary'} className="text-[10px]">
                    {warehouse.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
