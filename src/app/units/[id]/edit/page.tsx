import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import {  Save } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { updateUnitAction } from "../../actions"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function EditUnitPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  await requirePermissionPage('PRODUCT_UPDATE')
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  
  const unit = await db.productUnit.findUnique({
    where: { id: resolvedParams.id }
  })

  if (!unit) {
    redirect("/units")
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Editar Unidade</h2>
          <p className="text-muted-foreground">Altere os dados ou inative a unidade de medida.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {resolvedSearchParams.error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {resolvedSearchParams.error}
            </div>
          )}

          <form action={updateUnitAction} className="space-y-6">
            <input type="hidden" name="id" value={unit.id} />
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código / Sigla</label>
                  <Input name="code" defaultValue={unit.code} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input name="name" defaultValue={unit.name} required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Descrição (Opcional)</label>
                  <Input name="description" defaultValue={unit.description || ''} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select name="status" defaultValue={unit.status}>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/units">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
