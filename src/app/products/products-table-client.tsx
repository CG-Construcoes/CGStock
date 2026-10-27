"use client"

import { useState } from "react"
import Link from "next/link"
import { Printer, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProductActions } from "./product-actions"
import { cn } from "@/lib/utils"

export type ProductRowItem = {
  id: string
  code: string
  name: string
  category: { id: string; name: string }
  unit: { id: string; code: string; name: string }
  status: string
  averageCost: number | null
  totalStock: number
  warehouseName?: string | null
  warehouseCount?: number
}

export function ProductsTableClient({
  products,
  hasUpdate,
  hasDelete,
  selectedWarehouseId,
  paginationSlot,
}: {
  products: ProductRowItem[]
  hasUpdate: boolean
  hasDelete: boolean
  selectedWarehouseId?: string
  paginationSlot?: React.ReactNode
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(products.map((p) => p.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id])
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const isAllSelected = products.length > 0 && selectedIds.length === products.length
  const printUrl = `/products/print-labels?ids=${selectedIds.join(",")}`

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Banner Flutuante de Seleção */}
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-20 mb-3 flex items-center justify-between gap-4 p-3 rounded-lg bg-primary text-primary-foreground shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              <strong>{selectedIds.length}</strong> produto(s) selecionado(s) para impressão
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={printUrl}>
              <Button size="sm" variant="secondary" className="gap-1.5 text-xs font-semibold shadow-xs">
                <Printer className="h-3.5 w-3.5" />
                Imprimir {selectedIds.length} Etiqueta(s)
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="text-xs text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              Desmarcar
            </Button>
          </div>
        </div>
      )}

      {/* Main Data Table */}
      <div className="flex-1 bg-card border border-border overflow-hidden flex flex-col shadow-sm">
        {/* Mobile View */}
        <div className="divide-y divide-border md:hidden">
          {products.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado com os filtros atuais.
            </p>
          ) : (
            products.map((product) => {
              const isSelected = selectedIds.includes(product.id)
              return (
                <div
                  key={product.id}
                  className={cn("space-y-3 p-4 transition-colors", isSelected && "bg-primary/5")}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectOne(product.id, e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 mt-1 shrink-0"
                        aria-label={`Selecionar ${product.name}`}
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/products/${product.id}`}
                          className="block break-words font-semibold text-foreground hover:underline"
                        >
                          {product.name}
                        </Link>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {product.code} · {product.category.name}
                        </p>
                      </div>
                    </div>
                    <ProductActions
                      productId={product.id}
                      productCode={product.code}
                      productName={product.name}
                      hasUpdate={hasUpdate}
                      hasDelete={hasDelete}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm pl-7">
                    <span>
                      {product.totalStock.toLocaleString("pt-BR")} {product.unit.code} em estoque
                    </span>
                    <span
                      className={
                        product.status === "ACTIVE" ? "text-emerald-600 font-medium" : "text-muted-foreground"
                      }
                    >
                      {product.status === "ACTIVE" ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow className="border-b border-border">
                <TableHead className="h-10 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    aria-label="Selecionar todos os produtos da página"
                  />
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[120px]">
                  Cód.Insumo
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground">Produto</TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[150px]">
                  Categoria
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[80px] text-center">
                  Unid.
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[100px] text-right">
                  Estoque
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[120px] text-right">
                  Valor
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[100px] text-center">
                  Status
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[80px] text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const isSelected = selectedIds.includes(product.id)
                  const totalValue = product.totalStock * (product.averageCost || 0)

                  return (
                    <TableRow
                      key={product.id}
                      className={cn(
                        "border-b border-border hover:bg-muted/20 transition-colors",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      <TableCell className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectOne(product.id, e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                          aria-label={`Selecionar ${product.name}`}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-2 font-mono text-muted-foreground">
                        {product.code}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <div className="flex flex-col">
                          <Link
                            href={`/products/${product.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {product.name}
                          </Link>
                          {!selectedWarehouseId && product.warehouseName && (
                            <span className="text-[11px] text-muted-foreground">
                              {(product.warehouseCount ?? 1) > 1
                                ? `em ${product.warehouseCount} almoxarifados`
                                : product.warehouseName}
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
                        {product.totalStock.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right text-muted-foreground">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(totalValue)}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-center">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            product.status === "ACTIVE" ? "text-emerald-600" : "text-muted-foreground"
                          )}
                        >
                          {product.status === "ACTIVE" ? "Ativo" : "Inativo"}
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
        {paginationSlot}
      </div>
    </div>
  )
}
