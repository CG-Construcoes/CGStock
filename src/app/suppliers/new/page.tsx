import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {  Save } from "lucide-react"
import Link from "next/link"
import { createSupplierAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"

export default async function NewSupplierPage() {
  await requirePermissionPage('STOCK_ENTRY')
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Novo Fornecedor</h2>
          <p className="text-muted-foreground">Cadastre um novo fornecedor de materiais.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <form action={createSupplierAction} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Informações Principais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Razão Social / Nome</label>
                  <Input name="name" required placeholder="Razão Social completa" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome Fantasia</label>
                  <Input name="tradeName" placeholder="Nome Fantasia" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CPF / CNPJ</label>
                  <Input name="document" placeholder="Apenas números" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Contato e Endereço</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">E-mail</label>
                  <Input name="email" type="email" placeholder="contato@empresa.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefone</label>
                  <Input name="phone" placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CEP</label>
                  <Input name="zipCode" placeholder="00000-000" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cidade / Estado</label>
                  <div className="flex gap-2">
                    <Input name="city" placeholder="Cidade" className="flex-1" />
                    <Input name="state" placeholder="UF" className="w-20" />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Endereço Completo</label>
                  <Input name="address" placeholder="Rua, Número, Bairro, Complemento" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Observações</h3>
              <div className="space-y-2">
                <Input name="notes" placeholder="Informações adicionais sobre o fornecedor" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/suppliers">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
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
