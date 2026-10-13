import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { UserForm } from "./user-form"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function NewUserPage() {
  await requirePermissionPage('USER_MANAGE')
  const [roles, warehouses] = await Promise.all([
    db.role.findMany({ orderBy: { name: 'asc' } }),
    db.warehouse.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } })
  ])

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Novo Usuário</h2>
          <p className="text-muted-foreground">Cadastre um novo membro da equipe e defina suas permissões.</p>
        </div>
      </div>

      <Card className="rounded-md border-border shadow-sm bg-card ">
        <CardHeader>
          <CardTitle>Dados do Usuário</CardTitle>
          <CardDescription>
            Insira os dados básicos e escolha o perfil adequado para a operação deste funcionário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm roles={roles} warehouses={warehouses} />
        </CardContent>
      </Card>
    </div>
  )
}
