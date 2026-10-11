import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Truck, Hash, Mail, Phone } from "lucide-react"
import { db } from "@/lib/db"
import Link from "next/link"
import { requirePermissionPage } from "@/lib/permissions"

export default async function SuppliersPage() {
  await requirePermissionPage('CONFIG_MANAGE')
  const suppliers = await db.supplier.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fornecedores</h2>
          <p className="text-muted-foreground">Gerencie as empresas parceiras que fornecem produtos.</p>
        </div>
        <Link href="/admin/suppliers/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Fornecedor
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card  p-4 rounded-md border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar fornecedor por nome ou documento..." className="pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">Nenhum fornecedor cadastrado.</div>
        )}
        {suppliers.map(supplier => (
          <Link key={supplier.id} href={`/admin/suppliers/${supplier.id}`}>
            <Card className="hover:border-blue-300  cursor-pointer group h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white ">
                    <Truck className="h-6 w-6" />
                  </div>
                  <Badge variant={supplier.status === 'ACTIVE' ? 'success' : 'secondary'} className="text-[10px]">
                    {supplier.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <h3 className="font-bold text-lg mb-1 line-clamp-1">{supplier.name}</h3>
                {supplier.tradeName && <p className="text-xs text-muted-foreground mb-3">{supplier.tradeName}</p>}
                
                <div className="mt-4 space-y-2 flex-grow">
                  {supplier.document && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Hash className="h-3.5 w-3.5 mr-2 shrink-0" />
                      {supplier.document}
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 mr-2 shrink-0" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 mr-2 shrink-0" />
                      {supplier.phone}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
