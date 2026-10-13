import { db } from "@/lib/db"
import { warehouseIdFilter } from "@/lib/dal"
import { Card, CardContent } from "@/components/ui/card"
import { Smartphone, ChevronRight } from "lucide-react"
import Link from "next/link"

import { getValidatedSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAnyPermission } from "@/lib/permissions"

export default async function CollectorHomePage() {
  const session = await getValidatedSession()
  if (!session) {
    redirect("/login")
  }

  const isAdmin = session.roles?.includes('ADMIN')
  const canCount = isAdmin || await hasAnyPermission('INVENTORY_COUNT', 'INVENTORY_CREATE', 'INVENTORY_REVIEW', 'INVENTORY_APPROVE')
  if (!canCount) {
    redirect("/unauthorized")
  }

  const isAdminOrManager = session.roles.some(r => ['ADMIN', 'GESTOR'].includes(r))

  const activeInventories = await db.inventory.findMany({
    where: {
      status: 'IN_PROGRESS',
      ...await warehouseIdFilter(session.userId),
      // Se não for admin/gestor, filtra apenas os inventários onde o usuário é operador
      ...(isAdminOrManager ? {} : {
        operators: {
          some: { userId: session.userId }
        }
      })
    },
    include: {
      locations: {
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        include: { location: true }
      }
    }
  })

  return (
    <div className="min-h-screen bg-accent p-4 font-sans max-w-lg mx-auto">
      <div className="bg-primary text-white p-4 rounded-md shadow-sm mb-6 flex items-center gap-3">
        <Smartphone className="h-8 w-8" />
        <div>
          <h1 className="text-xl font-bold">Coletor Web</h1>
          <p className="text-primary-foreground/80 text-sm">Bem-vindo(a) ao Coletor</p>
        </div>
      </div>

      <h2 className="text-slate-900 dark:text-muted-foreground font-semibold mb-4 ml-1">Inventários Disponíveis</h2>

      {activeInventories.length === 0 ? (
        <Card className="border-none shadow-sm rounded-md">
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum inventário ativo atribuído a você no momento.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeInventories.map(inv => (
            <Card key={inv.id} className="border-none shadow-sm rounded-md overflow-hidden">
              <div className="bg-card p-4 border-b border-[#5C3310]">
                <h3 className="font-bold text-lg text-foreground">{inv.name}</h3>
                <p className="text-sm text-muted-foreground">{inv.code}</p>
              </div>
              <div className="bg-muted p-2">
                <p className="text-xs font-semibold text-muted-foreground px-2 pt-2 pb-1 uppercase tracking-wider">Locais Pendentes</p>
                {inv.locations.length === 0 ? (
                  <p className="text-sm p-2 text-muted-foreground">Nenhum local pendente.</p>
                ) : (
                  <div className="space-y-1 mt-1">
                    {inv.locations.map(l => (
                      <Link key={l.id} href={`/collector/${inv.id}/${l.locationId}`}>
                        <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-[#5C3310] hover:border-primary/50 cursor-pointer">
                          <span className="font-medium">{l.location.code}</span>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
