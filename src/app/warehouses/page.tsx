import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import { requireAnyPermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Almoxarifados | CGStock",
}

export default async function WarehousesPage() {
  await requireAnyPermissionPage('STOCK_VIEW', 'STOCK_ENTRY', 'STOCK_TRANSFER')
  const session = await getValidatedSession()
  const isAdmin = session?.roles?.includes('ADMIN')

  const scope = await warehouseScopeIds(session!.userId)
  const warehouses = await db.warehouse.findMany({
    where: scope === null ? undefined : { id: { in: scope } },
    orderBy: { name: 'asc' },
    include: { _count: { select: { locations: true } } }
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Almoxarifados</h2>
          <p className="text-muted-foreground">Visualize os almoxarifados disponíveis e suas localizações.</p>
        </div>
        {isAdmin && (
          <Link href="/admin/warehouses">
            <Button>Gerenciar Almoxarifados</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {warehouses.map(w => (
          <Link key={w.id} href={`/warehouses/${w.id}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">{w.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Código: {w.code}</span>
                  <span>{w._count.locations} localizações</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
