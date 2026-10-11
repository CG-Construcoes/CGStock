import { db } from "@/lib/db"
import { requireAnyPermissionPage, hasPermission } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyPermissionPage('STOCK_VIEW', 'STOCK_ENTRY', 'STOCK_TRANSFER')
  const session = await getValidatedSession()
  const canManage = session?.roles?.includes('ADMIN') || (await hasPermission('CONFIG_MANAGE'))
  const resolvedParams = await params

  const warehouse = await db.warehouse.findUnique({
    where: { id: resolvedParams.id },
    include: { locations: { orderBy: { name: 'asc' } } }
  })

  if (!warehouse) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{warehouse.name}</h2>
            <p className="text-muted-foreground">Código: {warehouse.code}</p>
          </div>
        </div>
        {canManage && (
          <Link href={`/admin/warehouses/${warehouse.id}`}>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Editar / Gerenciar
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={warehouse.status === 'ACTIVE' ? 'success' : 'secondary'}>{warehouse.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descrição:</span>
              <span>{warehouse.description || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Localizações ({warehouse.locations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {warehouse.locations.map(loc => (
                <li key={loc.id} className="flex justify-between border-b border-border pb-2 last:border-0">
                  <span className="font-medium">{loc.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{loc.code}</span>
                  </div>
                </li>
              ))}
              {warehouse.locations.length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhuma localização cadastrada.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
