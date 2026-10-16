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
import { ProductsTableClient } from "./products-table-client"
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

      {/* Main Data Table with Multi-Selection & Batch Print */}
      <ProductsTableClient
        products={productsList.map((product) => {
          const totalStock = product.stocks.reduce((acc, stock) => acc + Number(stock.quantity), 0)
          return {
            id: product.id,
            code: product.code,
            name: product.name,
            category: { id: product.category.id, name: product.category.name },
            unit: { id: product.unit.id, code: product.unit.code, name: product.unit.name },
            status: product.status,
            averageCost: product.averageCost ? Number(product.averageCost) : null,
            totalStock,
            warehouseName: product.stocks[0]?.warehouse?.name,
          }
        })}
        hasUpdate={hasUpdate}
        hasDelete={hasDelete}
        selectedWarehouseId={selectedWarehouseId}
        paginationSlot={
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
        }
      />
        </ProductsContentWrapper>
      </div>
    </ProductsTransitionProvider>
  )
}
