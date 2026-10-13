import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Filter, ClipboardList, Clock } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { warehouseIdFilter } from "@/lib/dal"
import { hasPermission, requireAnyPermissionPage } from "@/lib/permissions"

export default async function InventoryPage() {
  await requireAnyPermissionPage('INVENTORY_CREATE', 'INVENTORY_COUNT', 'INVENTORY_REVIEW', 'INVENTORY_APPROVE')
  const canCreate = await hasPermission('INVENTORY_CREATE')
  const inventories = await db.inventory.findMany({
    where: await warehouseIdFilter(),
    include: {
      warehouse: true,
      createdBy: true,
      _count: { select: { locations: true } },
      locations: {
        where: { status: 'COMPLETED' }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventários</h2>
          <p className="text-muted-foreground">Gerencie contagens, coletas e conferências de estoque.</p>
        </div>
        {canCreate && (
          <Link href="/inventory/new">
            <Button className="flex items-center gap-2 bg-primary hover:bg-primary text-white">
              <Plus className="h-4 w-4" />
              Novo Inventário
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card  p-4 rounded-md border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar inventário..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inventories.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">Nenhum inventário encontrado.</div>
        )}
        {inventories.map(inv => {
          const totalLocations = inv._count.locations
          const completedLocations = inv.locations.length
          const progress = totalLocations > 0 ? Math.round((completedLocations / totalLocations) * 100) : 0

          let statusVariant = "default"
          let statusLabel = inv.status
          if (inv.status === 'DRAFT') { statusVariant = "secondary"; statusLabel = "Rascunho" }
          if (inv.status === 'IN_PROGRESS' || inv.status === 'COUNTING') { statusVariant = "default"; statusLabel = "Em Andamento" }
          if (inv.status === 'CONFERENCE') { statusVariant = "warning"; statusLabel = "Conferência" }
          if (inv.status === 'COMPLETED') { statusVariant = "success"; statusLabel = "Concluído" }

          return (
            <Link key={inv.id} href={`/inventory/${inv.id}`}>
              <Card className="hover:shadow-sm  h-full">
                <CardContent className="p-6 h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-primary/5 rounded-lg">
                      <ClipboardList className="h-6 w-6 text-primary" />
                    </div>
                    {/* @ts-expect-error: Badge variant accepts dynamic string mapping here although TS complains */}
                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-1 truncate" title={inv.name}>{inv.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{inv.warehouse.name} • {inv.createdBy.name}</p>
                  
                  <div className="space-y-2 flex-grow">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Progresso</span>
                      <span className={
                        progress === 100 ? 'text-emerald-600' : 'text-blue-600'
                      }>{progress}%</span>
                    </div>
                    <div className="w-full bg-accent rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Locais coletados</span>
                      <span className="font-medium">{completedLocations} / {totalLocations}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Iniciado em</span>
                      <span className="font-medium text-sm flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {inv.startedAt ? new Date(inv.startedAt).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
