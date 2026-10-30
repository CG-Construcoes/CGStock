import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"
import { Save } from "lucide-react"
import { createSupplierAction } from "../actions"
import { requirePermissionPage } from "@/lib/permissions"
import { db } from "@/lib/db"

export default async function NewSupplierPage() {
  await requirePermissionPage('CONFIG_MANAGE')
  const categories = (await db.supplier.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  })).map((c) => c.category!).filter(Boolean)
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Novo Fornecedor</h2>
          <p className="text-muted-foreground">Cadastre um parceiro ou fornecedor de materiais.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Fornecedor</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSupplierAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Razão Social / Nome</Label>
              <Input id="name" name="name" required placeholder="Ex: Fornecedora de Peças Ltda" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tradeName">Nome Fantasia (Opcional)</Label>
              <Input id="tradeName" name="tradeName" placeholder="Ex: FornePeças" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="document">CNPJ / CPF</Label>
                <Input id="document" name="document" placeholder="Ex: 00.000.000/0000-00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" placeholder="Ex: (11) 99999-9999" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Empresa (ERP)</Label>
                <select
                  id="source"
                  name="source"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Sem vínculo</option>
                  <option value="MGA">MGA — CG Construções</option>
                  <option value="CV">CV — Conceito</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="erpCode">Código no Informakon</Label>
                <Input id="erpCode" name="erpCode" placeholder="Ex: 015362" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input id="category" name="category" list="supplier-categories" placeholder="Ex: Fornecedores de Materiais" />
                <datalist id="supplier-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail de Contato</Label>
              <Input id="email" name="email" type="email" placeholder="contato@empresa.com.br" />
            </div>
            
            <input type="hidden" name="status" value="ACTIVE" />

            <div className="pt-4 flex justify-end gap-2">
              <BackButton />
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Fornecedor
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
