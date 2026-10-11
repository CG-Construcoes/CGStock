import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import {  Save } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { updateCategoryAction } from "../../actions"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function EditCategoryPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  await requirePermissionPage('PRODUCT_UPDATE')
  const params = await props.params;
  const searchParams = await props.searchParams;

  const category = await db.productCategory.findUnique({
    where: { id: params.id }
  })

  if (!category) {
    redirect("/categories")
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Editar Categoria</h2>
          <p className="text-muted-foreground">Altere os dados ou inative a categoria.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {searchParams.error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {searchParams.error}
            </div>
          )}

          <form action={updateCategoryAction} className="space-y-6">
            <input type="hidden" name="id" value={category.id} />
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Categoria</label>
                <Input name="name" defaultValue={category.name} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição (Opcional)</label>
                <Input name="description" defaultValue={category.description || ''} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select name="status" defaultValue={category.status}>
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/categories">
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
