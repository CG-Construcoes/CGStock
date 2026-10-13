import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { db } from "@/lib/db"
import { warehouseScopeIds, requirePageUser } from "@/lib/dal"
import Link from "next/link"
import { requirePermissionPage } from "@/lib/permissions"
import { WarehousesClient } from "./warehouses-client"

export const metadata = {
  title: "Gestão de Almoxarifados | Admin CGStock",
}

export default async function WarehousesPage() {
  await requirePermissionPage('CONFIG_MANAGE')
  const actor = await requirePageUser()
  const scope = await warehouseScopeIds(actor.session.userId)
  const warehouses = await db.warehouse.findMany({
    where: { id: { in: scope ?? undefined } },
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
        {actor.ctx.roleNames.includes('ADMIN') && <Link href="/admin/warehouses/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Almoxarifado
          </Button>
        </Link>}
      </div>

      <WarehousesClient warehouses={warehouses} />
    </div>
  )
}
