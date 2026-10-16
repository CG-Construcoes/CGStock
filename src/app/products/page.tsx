import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { db } from "@/lib/db"
import { ProductActions } from "./product-actions"
import {
  ProductsTransitionProvider,
  ProductsFilterForm,
  ProductsContentWrapper,
} from "./products-filter-client"
import { cn } from "@/lib/utils"
import { Prisma } from "@prisma/client"
import { resolveWarehouseContext } from "@/lib/dal"

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
  const warehouseParam = resolvedSearchParams.warehouseId as string | undefined

  const { warehouses, selectedWarehouseId, warehouseWhere: wFilter } = await resolveWarehouseContext(warehouseParam)
  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId)

  const where: Prisma.ProductWhereInput = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } }
    ]
  }
  if (categoryId) where.categoryId = categoryId
  if (status) where.status = status
  if (selectedWarehouseId) {
    where.stocks = { some: { warehouseId: selectedWarehouseId } }
  } else if (wFilter) {
    where.stocks = { some: wFilter }
  }

  const page = parseInt(resolvedSearchParams.page as string) || 1
  const pageSize = 50

  const [productsList, totalCount, categories, allProductsSlim] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: true,
        unit: true,
        stocks: { where: wFilter, include: { warehouse: { select: { name: true, code: true } } } }
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
        stocks: { where: wFilter, select: { quantity: true } }
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
    <ProductsTransitionProvider>
      <div className="flex flex-col h-full space-y-4">
        {/* Header and Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 border border-border shadow-sm">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Produtos</h2>
            {selectedWarehouse && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Filtrado por: <span className="font-semibold text-foreground">{selectedWarehouse.name}</span>
              </p>
            )}
          </div>

          <ProductsFilterForm
            search={search || ""}
            selectedWarehouseId={selectedWarehouseId || ""}
            warehouses={warehouses}
            categoryId={categoryId || ""}
            categories={categories}
            status={status || ""}
            hasCreate={hasCreate}
          />
        </div>

        <ProductsContentWrapper>
          {/* KPI Stats (Compact) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-border bg-card border border-border shadow-sm">
        <div className="min-w-0 p-3 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total (Tipos)</span>
          <span className="text-lg font-bold text-foreground leading-none mt-1">{totalCount.toLocaleString('pt-BR')}</span>
        </div>
        <div className="min-w-0 p-3 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estoque (Unidades)</span>
          <span className="text-lg font-bold text-foreground leading-none mt-1">{new Intl.NumberFormat('pt-BR').format(totalItemsInStock)}</span>
        </div>
        <div className="col-span-2 sm:col-span-1 min-w-0 p-3 flex flex-col border-t sm:border-t-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor Total em Estoque</span>
          <span className="text-lg font-bold text-primary leading-none mt-1">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grandTotalValue)}</span>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="flex-1 bg-card border border-border overflow-hidden flex flex-col shadow-sm">
        <div className="divide-y divide-border md:hidden">
          {productsList.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Nenhum produto encontrado com os filtros atuais.</p> : productsList.map(product => {
            const quantity = product.stocks.reduce((sum, stock) => sum + Number(stock.quantity), 0)
            return (
              <div key={product.id} className="space-y-3 p-4">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/products/${product.id}`} className="block break-words font-semibold text-foreground hover:underline">{product.name}</Link>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{product.code} · {product.category.name}</p>
                  </div>
                  <ProductActions productId={product.id} productCode={product.code} productName={product.name} hasUpdate={hasUpdate} hasDelete={hasDelete} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{quantity.toLocaleString('pt-BR')} {product.unit.code} em estoque</span>
                  <span className={product.status === 'ACTIVE' ? 'text-emerald-600' : 'text-muted-foreground'}>{product.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="hidden md:block overflow-x-auto">
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
                  const warehouseName = product.stocks[0]?.warehouse?.name
                  return (
                    <TableRow 
                      key={product.id}
                      className="border-b border-border hover:bg-muted/20"
                    >
                      <TableCell className="px-4 py-2 font-mono text-muted-foreground">{product.code}</TableCell>
                      <TableCell className="px-4 py-2">
                        <div className="flex flex-col">
                          <Link href={`/products/${product.id}`} className="font-medium text-foreground hover:underline">
                            {product.name}
                          </Link>
                          {!selectedWarehouseId && warehouseName && (
                            <span className="text-[11px] text-muted-foreground">
                              {warehouseName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {product.category.name}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-center text-muted-foreground">
                        {product.unit.code}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right font-medium">
                        {totalStock.toLocaleString('pt-BR')}
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
            Total de <strong>{totalCount.toLocaleString('pt-BR')}</strong> produtos encontrados
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
        </ProductsContentWrapper>
      </div>
    </ProductsTransitionProvider>
  )
}
