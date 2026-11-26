"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Printer, CheckCircle2, Tags, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProductActions } from "./product-actions"
import { cn } from "@/lib/utils"
import { updateProductsCategoryAction } from "./actions"
import { QuickNumberCell, QuickSelectCell, QuickStockCell } from "@/components/quick-edit/quick-edit"
import { formatCurrency } from "@/lib/utils"

const STATUS_OPTIONS = [{ value: "ACTIVE", label: "Ativo" }, { value: "INACTIVE", label: "Inativo" }]

type CategoryOption = { id: string; name: string; active: boolean }

function CategorySelect({
  value,
  categories,
  disabled,
  onChange,
  className,
  placeholder,
}: {
  value: string
  categories: CategoryOption[]
  disabled?: boolean
  onChange: (categoryId: string) => void
  className?: string
  placeholder?: string
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      aria-label="Categoria"
      className={cn("h-8 max-w-full rounded-md border border-transparent bg-transparent px-1.5 text-sm hover:border-border focus:border-primary focus:outline-none disabled:opacity-50 cursor-pointer", className)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {categories.filter((c) => c.active || c.id === value).map((c) => (
        <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (inativa)"}</option>
      ))}
    </select>
  )
}

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
  categories = [],
  units = [],
  canAdjustStock = false,
}: {
  products: ProductRowItem[]
  categories?: CategoryOption[]
  units?: { id: string; code: string }[]
  canAdjustStock?: boolean
  hasUpdate: boolean
  hasDelete: boolean
  selectedWarehouseId?: string
  paginationSlot?: React.ReactNode
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSaving, startSaving] = useTransition()
  const [savingIds, setSavingIds] = useState<string[]>([])
  const router = useRouter()
  const canEditCategory = hasUpdate && categories.length > 0
  const unitOptions = (current: { id: string; code: string }) =>
    (units.some(u => u.id === current.id) ? units : [current, ...units]).map(u => ({ value: u.id, label: u.code }))

  const changeCategory = (ids: string[], categoryId: string) => {
    setSavingIds(ids)
    startSaving(async () => {
      const res = await updateProductsCategoryAction(ids, categoryId)
      setSavingIds([])
      if (res.error) return void toast.error(res.error)
      toast.success(ids.length > 1 ? `${res.count} produtos movidos para "${res.categoryName}".` : `Categoria alterada para "${res.categoryName}".`)
      if (ids.length > 1) setSelectedIds([])
      router.refresh()
    })
  }

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
              <strong>{selectedIds.length}</strong> produto(s) selecionado(s)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEditCategory && (
              <div className="flex items-center gap-1.5 rounded-md bg-primary-foreground/10 pl-2">
                {isSaving && savingIds.length > 1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tags className="h-3.5 w-3.5" />}
                <CategorySelect
                  value=""
                  categories={categories}
                  disabled={isSaving}
                  placeholder="Alterar categoria..."
                  onChange={(categoryId) => changeCategory(selectedIds, categoryId)}
                  className="h-8 text-xs font-semibold text-primary-foreground [&>option]:text-foreground hover:border-primary-foreground/30"
                />
              </div>
            )}
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
                        <div className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                          <span className="break-all">{product.code} ·</span>
                          {canEditCategory ? (
                            <CategorySelect
                              value={product.category.id}
                              categories={categories}
                              disabled={isSaving && savingIds.includes(product.id)}
                              onChange={(categoryId) => categoryId !== product.category.id && changeCategory([product.id], categoryId)}
                              className="h-6 text-xs px-1 -ml-1 border-border/60"
                            />
                          ) : (
                            <span>{product.category.name}</span>
                          )}
                        </div>
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
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm pl-7">
                    <span className="inline-flex items-center gap-1">
                      <QuickStockCell productId={product.id} unitCode={product.unit.code} canEdit={canAdjustStock} align="left"
                        display={<span className="font-semibold">{product.totalStock.toLocaleString("pt-BR")}</span>} />
                      <QuickSelectCell productId={product.id} field="unitId" value={product.unit.id} options={unitOptions(product.unit)} canEdit={hasUpdate}
                        className="h-7 px-1 text-sm" display={product.unit.code} />
                      <span className="text-muted-foreground">em estoque</span>
                    </span>
                    <QuickNumberCell productId={product.id} canEdit={hasUpdate} title="Custo médio unitário"
                      fields={[{ field: "averageCost", label: "Custo médio unitário", value: product.averageCost ?? 0, money: true }]}
                      display={<span className="text-muted-foreground">{formatCurrency(product.totalStock * (product.averageCost || 0))}</span>} />
                    <QuickSelectCell productId={product.id} field="status" value={product.status} options={STATUS_OPTIONS} canEdit={hasUpdate}
                      className={cn("h-7 px-1 text-sm", product.status === "ACTIVE" ? "text-emerald-600 font-medium" : "text-muted-foreground")}
                      display={<span className={product.status === "ACTIVE" ? "text-emerald-600 font-medium" : "text-muted-foreground"}>{product.status === "ACTIVE" ? "Ativo" : "Inativo"}</span>} />
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
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[190px]">
                  Categoria
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[90px] text-center">
                  Unid.
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[120px] text-right">
                  Estoque
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[140px] text-right">
                  Valor
                </TableHead>
                <TableHead className="h-10 px-4 font-semibold text-muted-foreground w-[110px] text-center">
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
                      <TableCell className="px-2 py-1 text-muted-foreground">
                        {canEditCategory ? (
                          <CategorySelect
                            value={product.category.id}
                            categories={categories}
                            disabled={isSaving && savingIds.includes(product.id)}
                            onChange={(categoryId) => categoryId !== product.category.id && changeCategory([product.id], categoryId)}
                            className="w-full"
                          />
                        ) : (
                          product.category.name
                        )}
                      </TableCell>
                      <TableCell className="px-2 py-1 text-center text-muted-foreground">
                        <QuickSelectCell productId={product.id} field="unitId" value={product.unit.id} options={unitOptions(product.unit)} canEdit={hasUpdate}
                          className="text-center" display={product.unit.code} />
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right font-medium">
                        <QuickStockCell productId={product.id} unitCode={product.unit.code} canEdit={canAdjustStock}
                          display={product.totalStock.toLocaleString("pt-BR")} />
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right text-muted-foreground">
                        <QuickNumberCell productId={product.id} canEdit={hasUpdate} title="Custo médio unitário"
                          fields={[{ field: "averageCost", label: "Custo médio unitário", value: product.averageCost ?? 0, money: true }]}
                          display={formatCurrency(totalValue)} />
                      </TableCell>
                      <TableCell className="px-2 py-1 text-center">
                        <QuickSelectCell productId={product.id} field="status" value={product.status} options={STATUS_OPTIONS} canEdit={hasUpdate}
                          className={cn("text-xs font-medium", product.status === "ACTIVE" ? "text-emerald-600" : "text-muted-foreground")}
                          display={<span className={cn("text-xs font-medium", product.status === "ACTIVE" ? "text-emerald-600" : "text-muted-foreground")}>{product.status === "ACTIVE" ? "Ativo" : "Inativo"}</span>} />
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
