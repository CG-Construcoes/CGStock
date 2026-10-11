import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Filter, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { requirePermissionPage } from "@/lib/permissions"

export default async function SuppliersPage() {
  await requirePermissionPage('STOCK_ENTRY')
  const suppliers = await db.supplier.findMany({
    include: {
      _count: { select: { receipts: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

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

      <div className="flex flex-col sm:flex-row gap-4 bg-card  p-4 rounded-md border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou documento..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="bg-card  rounded-md border border-border shadow-sm  overflow-hidden  ">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-border/50">
          {suppliers.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-base font-medium text-foreground mb-1">Nenhum fornecedor</p>
              <p className="text-sm text-muted-foreground">Você ainda não possui fornecedores cadastrados.</p>
            </div>
          ) : (
            suppliers.map((supplier) => (
              <div key={supplier.id} className="p-5 space-y-4 bg-transparent hover:bg-muted/20 ">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm uppercase">
                      {supplier.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <Link href={`/suppliers/${supplier.id}`} className="font-semibold text-base text-foreground leading-tight hover:text-primary  line-clamp-1">
                        {supplier.name}
                      </Link>
                      {supplier.tradeName && <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{supplier.tradeName}</span>}
                    </div>
                  </div>
                  {supplier.status === 'ACTIVE' ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-medium whitespace-nowrap">
                      <span className="h-1 w-1 rounded-full bg-emerald-600 "></span>
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-blue-500/10 hover:text-blue-600 ">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
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
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Documento</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">E-mail</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Telefone</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider text-right">Entradas</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Status</TableHead>
              <TableHead className="h-14 px-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="rounded-full bg-muted/50 p-4">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-lg font-medium text-foreground">Nenhum fornecedor encontrado</p>
                    <p className="text-sm text-muted-foreground">Você ainda não possui fornecedores cadastrados no sistema.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow 
                  key={supplier.id}
                  className="group border-b border-border hover:bg-primary/[0.02]   "
                >
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm group-hover:bg-primary group-hover:text-primary-foreground   uppercase">
                        {supplier.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <Link href={`/suppliers/${supplier.id}`} className="font-semibold text-base text-foreground group-hover:text-primary  ">
                          {supplier.name}
                        </Link>
                        {supplier.tradeName && <div className="text-xs text-muted-foreground mt-0.5">{supplier.tradeName}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground">
                    {supplier.document || '-'}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground">
                    {supplier.email || '-'}
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
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-9 w-9 rounded-full opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 hover:text-blue-600   translate-x-2 group-hover:translate-x-0"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  )
}
