import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, MoreHorizontal, ChevronLeft, ChevronRight, Building2 } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { warehouseIdFilter } from "@/lib/dal"
import { requirePermissionPage } from "@/lib/permissions"
import { SupplierFilterForm } from "@/components/supplier-filter-form"

const PAGE_SIZE = 48

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string; source?: string; category?: string; page?: string }> }) {
  await requirePermissionPage('STOCK_ENTRY')
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

  const receiptWhere = await warehouseIdFilter()

  const [total, suppliers, categories] = await Promise.all([
    db.supplier.count({ where }),
    db.supplier.findMany({
      where,
      include: {
        _count: { select: { receipts: { where: receiptWhere } } }
      },
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
          <p className="text-muted-foreground">Gerencie os fornecedores de materiais do almoxarifado.</p>
        </div>
        <Link href="/suppliers/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo fornecedor
          </Button>
        </Link>
      </div>

      <SupplierFilterForm q={q} source={source} category={category} categories={categories.map((c) => c.category!).filter(Boolean)} basePath="/suppliers" />

      <div className="text-sm text-muted-foreground">
        {total.toLocaleString("pt-BR")} fornecedor{total === 1 ? "" : "es"}
        {total > PAGE_SIZE && ` — página ${currentPage} de ${totalPages.toLocaleString("pt-BR")}`}
      </div>

      <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-border/50">
          {suppliers.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-base font-medium text-foreground mb-1">Nenhum fornecedor</p>
              <p className="text-sm text-muted-foreground">Tente buscar com outro termo ou cadastre um novo.</p>
            </div>
          ) : (
            suppliers.map((supplier) => (
              <div key={supplier.id} className="p-5 space-y-4 bg-transparent hover:bg-muted/20">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm uppercase">
                      {supplier.name.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <Link href={`/suppliers/${supplier.id}`} className="font-semibold text-base text-foreground leading-tight hover:text-primary line-clamp-1">
                        {supplier.name}
                      </Link>
                      {supplier.tradeName && <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{supplier.tradeName}</span>}
                      <div className="flex items-center gap-1.5 mt-1">
                        {supplier.source && (
                          <Badge variant={supplier.source === 'MGA' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                            {supplier.source}
                          </Badge>
                        )}
                        {supplier.category && <span className="text-[10px] text-muted-foreground line-clamp-1">{supplier.category}</span>}
                      </div>
                    </div>
                  </div>
                  {supplier.status === 'ACTIVE' ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-medium whitespace-nowrap">
                      <span className="h-1 w-1 rounded-full bg-emerald-600"></span>
                      Ativo
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600 border border-zinc-500/20 text-[10px] font-medium whitespace-nowrap">
                      <span className="h-1 w-1 rounded-full bg-zinc-600"></span>
                      Inativo
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-muted/30 rounded-lg border border-border">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Documento</span>
                    <span className="font-medium text-foreground">{supplier.document || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Telefone</span>
                    <span className="font-medium text-foreground">{supplier.phone || '-'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 rounded-full bg-secondary/50 border border-border text-xs font-medium text-muted-foreground">
                      <span className="text-foreground font-semibold mr-1">{supplier._count.receipts}</span>
                      entradas
                    </div>
                  </div>
                  <Link href={`/suppliers/${supplier.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-blue-500/10 hover:text-blue-600">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto p-1">
          <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Nome</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Empresa</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Categoria</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Documento</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Telefone</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider text-right">Entradas</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Status</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="rounded-full bg-muted/50 p-4">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-lg font-medium text-foreground">Nenhum fornecedor encontrado</p>
                    <p className="text-sm text-muted-foreground">Tente buscar com outro termo ou ajuste os filtros.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  className="group border-b border-border hover:bg-primary/[0.02]"
                >
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm group-hover:bg-primary group-hover:text-primary-foreground uppercase">
                        {supplier.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <Link href={`/suppliers/${supplier.id}`} className="font-semibold text-base text-foreground group-hover:text-primary">
                          {supplier.name}
                        </Link>
                        {supplier.tradeName && <div className="text-xs text-muted-foreground mt-0.5">{supplier.tradeName}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {supplier.source ? (
                      <Badge variant={supplier.source === 'MGA' ? 'default' : 'secondary'} className="text-[11px]">
                        <Building2 className="h-3 w-3 mr-1" />
                        {supplier.source}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground text-sm">
                    {supplier.category || '-'}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground">
                    {supplier.document || '-'}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground">
                    {supplier.phone || '-'}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <div className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 rounded-full bg-secondary/60 border border-border text-sm font-semibold text-foreground">
                      {supplier._count.receipts}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {supplier.status === 'ACTIVE' ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-sm font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-[pulse_2s_ease-in-out_infinite]"></span>
                        Ativo
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-500/10 text-zinc-600 border border-zinc-500/20 text-sm font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600"></span>
                        Inativo
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <Link href={`/suppliers/${supplier.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 hover:text-blue-600 translate-x-2 group-hover:translate-x-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
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
