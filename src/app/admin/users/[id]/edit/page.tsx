import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { BackButton } from "@/components/ui/back-button"
import { EditUserForm } from "./edit-user-form"
import { requirePageUser } from "@/lib/dal"

export default async function EditUserPage(props: { params: Promise<{ id: string }> }) {
  const actor = await requirePageUser()
  if (!actor.ctx.roleNames.includes('ADMIN')) redirect('/unauthorized')
  const params = await props.params;
  const user = await db.user.findUnique({
    where: { id: params.id },
    include: {
      roles: true,
      worksiteAccesses: true,
      warehouseAccesses: {
        include: { warehouse: { select: { id: true, name: true, code: true } } }
      }
    }
  })

  if (!user) {
    redirect("/admin/users")
  }

  const roles = await db.role.findMany({
    orderBy: { name: 'asc' }
  })

  const worksites = await db.worksite.findMany({
    orderBy: { name: 'asc' }
  })

  const warehouses = await db.warehouse.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true, status: true }
  })

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Editar Usuário</h2>
          <p className="text-muted-foreground">{user.name}</p>
        </div>
      </div>

      <Card className="rounded-md border-border shadow-sm bg-card ">
        <CardHeader>
          <CardTitle>Dados do Usuário</CardTitle>
          <CardDescription>
            Edite as informações do usuário, perfis, obras e almoxarifados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditUserForm user={user} roles={roles} worksites={worksites} warehouses={warehouses} />
        </CardContent>
      </Card>
    </div>
  )
}
