import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {  Save } from "lucide-react"
import Link from "next/link"
import { createUnitAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function NewUnitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requirePermissionPage('PRODUCT_CREATE')
  const resolvedSearchParams = await searchParams;
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Unidade</h2>
          <p className="text-muted-foreground">Adicione uma nova unidade de medida.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {resolvedSearchParams.error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {resolvedSearchParams.error}
            </div>
          )}

          <form action={createUnitAction} className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código / Sigla</label>
                  <Input name="code" placeholder="Ex: UN, CX, KG" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input name="name" placeholder="Ex: Unidade, Caixa" required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Descrição (Opcional)</label>
                  <Input name="description" placeholder="Descrição detalhada" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/units">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Unidade
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
