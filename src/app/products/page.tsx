import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { ProductActions } from "./product-actions"
import { cn } from "@/lib/utils"
import { Prisma } from "@prisma/client"

import { requirePermissionPage, hasPermission } from "@/lib/permissions"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await requirePermissionPage('PRODUCT_VIEW')
  const [hasCreate, hasUpdate, hasDelete] = await Promise.all([
    hasPermission('PRODUCT_CREATE'),
    hasPermission('PRODUCT_UPDATE'),
    hasPermission('PRODUCT_DELETE')
  ])
  const resolvedSearchParams = await searchParams
  const search = resolvedSearchParams.q as string
  const categoryId = resolvedSearchParams.category as string
  const status = resolvedSearchParams.status as string

  const where: Prisma.ProductWhereInput = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } }
    ]
  }
  if (categoryId) where.categoryId = categoryId
  if (status) where.status = status

  const page = parseInt(resolvedSearchParams.page as string) || 1
  const pageSize = 50

  const [productsList, totalCount, categories, allProductsSlim] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: true,
        unit: true,
        defaultLocation: { include: { warehouse: true } },
        stocks: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.product.count({ where }),
    db.productCategory.findMany({ orderBy: { name: 'asc' } }),
    // Optimized slim fetch for summary cards
    db.product.findMany({
      where,
      select: {
        averageCost: true,
        stocks: { select: { quantity: true } }
      }
    })
  ])

  // Calculate summaries efficiently
  let grandTotalValue = 0
  let totalItemsInStock = 0

  allProductsSlim.forEach(product => {
    const totalStock = product.stocks.reduce((acc, stock) => acc + Number(stock.quantity), 0)
    const cost = Number(product.averageCost || 0)
    grandTotalValue += totalStock * cost
    totalItemsInStock += totalStock
  })
  
  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header and Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 border border-border shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Produtos</h2>
        </div>
        
        <form method="GET" className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input name="q" defaultValue={search || ""} placeholder="Buscar por Cód.Insumo ou descrição..." className="pl-9 h-9 text-sm" />
          </div>
          
          <select name="category" defaultValue={categoryId || ""} className="h-9 w-full sm:w-40 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Categorias (Todas)</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          
          <select name="status" defaultValue={status || ""} className="h-9 w-full sm:w-32 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Status (Todos)</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
          
          <Button type="submit" variant="secondary" className="h-9 px-3 text-sm">
            Filtrar
          </Button>

          <div className="h-6 w-px bg-border hidden sm:block mx-1"></div>

          {hasCreate && (
            <Link href="/products/new">
              <Button className="h-9 px-3 text-sm bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            </Link>
          )}
        </form>
      </div>

      {/* KPI Stats (Compact) */}
      <div className="flex flex-row divide-x divide-border bg-card border border-border shadow-sm">
        <div className="flex-1 p-3 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total (Tipos)</span>
          <span className="text-lg font-bold text-foreground leading-none mt-1">{totalCount}</span>
        </div>
        <div className="flex-1 p-3 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estoque (Unidades)</span>
          <span className="text-lg font-bold text-foreground leading-none mt-1">{new Intl.NumberFormat('pt-BR').format(totalItemsInStock)}</span>
        </div>
        <div className="flex-1 p-3 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor Total em Estoque</span>
          <span className="text-lg font-bold text-primary leading-none mt-1">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grandTotalValue)}</span>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="flex-1 bg-card border border-border overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow className="border-b border-border">
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[120px]">Cód.Insumo</TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground">Produto</TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[150px]">Categoria</TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[80px] text-center">Unid.</TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[100px] text-right">Estoque</TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[120px] text-right">Valor</TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[100px] text-center">Status</TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[80px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                productsList.map((product) => {
                  const totalStock = product.stocks.reduce((acc, stock) => acc + Number(stock.quantity), 0)
                  const totalValue = totalStock * Number(product.averageCost || 0)
                  return (
                    <TableRow 
                      key={product.id}
                      className="border-b border-border hover:bg-muted/20"
                    >
                      <TableCell className="px-4 py-2 font-mono text-muted-foreground">{product.code}</TableCell>
                      <TableCell className="px-4 py-2">
                        <Link href={`/products/${product.id}`} className="font-medium text-foreground hover:underline">
                          {product.name}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {product.category.name}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-center text-muted-foreground">
                        {product.unit.code}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right font-medium">
                        {totalStock}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right text-muted-foreground">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-center">
                        <span className={cn(
                          "text-xs font-medium",
                          product.status === 'ACTIVE' ? "text-emerald-600" : "text-muted-foreground"
                        )}>
                          {product.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right">
                        <ProductActions 
                          productId={product.id} 
                          productCode={product.code} 
                          productName={product.name}
                          hasUpdate={hasUpdate}
                          hasDelete={hasDelete}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Footer / Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 bg-muted/20 mt-auto">
          <div className="text-sm text-muted-foreground">
            Total de <strong>{totalCount}</strong> produtos encontrados
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">
                Página {page} de {totalPages}
              </span>
              <Link href={page > 1 ? `/products?${new URLSearchParams({ ...resolvedSearchParams, page: String(page - 1) }).toString()}` : '#'}>
                <Button variant="outline" size="sm" disabled={page <= 1} className="h-8 text-xs">
                  Anterior
                </Button>
              </Link>
              <Link href={page < totalPages ? `/products?${new URLSearchParams({ ...resolvedSearchParams, page: String(page + 1) }).toString()}` : '#'}>
                <Button variant="outline" size="sm" disabled={page >= totalPages} className="h-8 text-xs">
                  Próxima
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
