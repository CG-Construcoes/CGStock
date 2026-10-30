import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Truck, Hash, Mail, Phone, FileSpreadsheet, ChevronLeft, ChevronRight, Building2, Tag } from "lucide-react"
import { db } from "@/lib/db"
import Link from "next/link"
import { requirePermissionPage } from "@/lib/permissions"
import { SupplierFilterForm } from "@/components/supplier-filter-form"

const PAGE_SIZE = 48

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string; source?: string; category?: string; page?: string }> }) {
  await requirePermissionPage('CONFIG_MANAGE')
  const params = await searchParams
  const q = (params.q || "").trim()
  const source = params.source === "MGA" || params.source === "CV" ? params.source : ""
  const category = (params.category || "").trim()
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1)

  const where = {
    ...(source ? { source } : {}),
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { tradeName: { contains: q, mode: "insensitive" as const } },
            { document: { contains: q.replace(/\D/g, "") || q, mode: "insensitive" as const } },
            { erpCode: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [total, suppliers, categories] = await Promise.all([
    db.supplier.count({ where }),
    db.supplier.findMany({
      where,
      orderBy: [{ registeredAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.supplier.findMany({
      where: { category: { not: null }, ...(source ? { source } : {}) },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams()
    const merged = { q, source, category, page: String(currentPage), ...overrides }
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v)
    return `?${p.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fornecedores</h2>
          <p className="text-muted-foreground">Gerencie as empresas parceiras que fornecem produtos.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link href="/admin/suppliers/import" className="flex-1 sm:flex-none">
            <Button variant="outline" className="flex items-center gap-2 w-full">
              <FileSpreadsheet className="h-4 w-4" />
              Importar
            </Button>
          </Link>
          <Link href="/admin/suppliers/new" className="flex-1 sm:flex-none">
            <Button className="flex items-center gap-2 w-full">
              <Plus className="h-4 w-4" />
              Novo Fornecedor
            </Button>
          </Link>
        </div>
      </div>

      <SupplierFilterForm q={q} source={source} category={category} categories={categories.map((c) => c.category!).filter(Boolean)} basePath="/admin/suppliers" />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total.toLocaleString("pt-BR")} fornecedor{total === 1 ? "" : "es"}
          {total > PAGE_SIZE && ` — página ${currentPage} de ${totalPages.toLocaleString("pt-BR")}`}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">Nenhum fornecedor encontrado.</div>
        )}
        {suppliers.map(supplier => (
          <Link key={supplier.id} href={`/admin/suppliers/${supplier.id}`}>
            <Card className="hover:border-blue-300 cursor-pointer group h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={supplier.status === 'ACTIVE' ? 'success' : 'secondary'} className="text-[10px]">
                      {supplier.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {supplier.source && (
                      <Badge variant={supplier.source === 'MGA' ? 'default' : 'secondary'} className="text-[10px]">
                        <Building2 className="h-3 w-3 mr-1" />
                        {supplier.source}
                      </Badge>
                    )}
                  </div>
                </div>
                <h3 className="font-bold text-lg mb-1 line-clamp-1">{supplier.name}</h3>
                {supplier.tradeName && <p className="text-xs text-muted-foreground mb-1">{supplier.tradeName}</p>}
                {supplier.category && (
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                    <Tag className="h-3 w-3" />{supplier.category}
                  </p>
                )}

                <div className="mt-4 space-y-2 flex-grow">
                  {supplier.erpCode && (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Hash className="h-3.5 w-3.5 mr-2 shrink-0" />
                      Cód. {supplier.erpCode}
                    </div>
                  )}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          {currentPage > 1 ? (
            <Link href={qs({ page: String(currentPage - 1) })}>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages.toLocaleString("pt-BR")}
          </span>
          {currentPage < totalPages ? (
            <Link href={qs({ page: String(currentPage + 1) })}>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled className="flex items-center gap-1">
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
