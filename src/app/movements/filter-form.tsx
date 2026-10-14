"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Filter, Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { setActiveWarehouseAction } from "@/app/auth-actions"

export function MovementsFilterForm({
  products,
  warehouses,
  defaultValues
}: {
  products: { id: string; code: string; name: string }[]
  warehouses: { id: string; name: string }[]
  defaultValues: { q: string; type: string; productId: string; warehouseId: string; referenceType: string }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [q, setQ] = useState(defaultValues.q)
  const [type, setType] = useState(defaultValues.type)
  const [productId, setProductId] = useState(defaultValues.productId)
  const [warehouseId, setWarehouseId] = useState(defaultValues.warehouseId)

  const handleFilter = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const params = new URLSearchParams(searchParams.toString())
    
    if (q) params.set('q', q)
    else params.delete('q')

    if (type && type !== 'ALL') params.set('type', type)
    else params.delete('type')

    if (productId && productId !== 'ALL') params.set('productId', productId)
    else params.delete('productId')

    if (warehouseId && warehouseId !== 'ALL') {
      params.set('warehouseId', warehouseId)
      await setActiveWarehouseAction(warehouseId)
    } else {
      params.delete('warehouseId')
      await setActiveWarehouseAction('ALL')
    }

    // reset to page 1 on filter
    params.delete('page')

    router.push(`/movements?${params.toString()}`)
    router.refresh()
  }

  const clearFilters = async () => {
    await setActiveWarehouseAction('ALL')
    router.push('/movements')
    router.refresh()
    setQ('')
    setType('')
    setProductId('')
    setWarehouseId('')
  }

  const hasActiveFilters = Boolean(q || (type && type !== 'ALL') || (productId && productId !== 'ALL') || (warehouseId && warehouseId !== 'ALL'))

  return (
    <form onSubmit={handleFilter} className="flex flex-col gap-4 bg-card p-4 rounded-lg border border-border">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por documento..." 
            className="pl-9" 
          />
        </div>
        
        <Select value={type || "ALL"} onChange={(e) => setType(e.target.value)} className="w-full sm:w-[180px]">
          <option value="ALL">Todos os Tipos</option>
          <option value="ENTRY">Entrada</option>
          <option value="EXIT">Saída</option>
          <option value="ADJUSTMENT_IN">Ajuste (+)</option>
          <option value="ADJUSTMENT_OUT">Ajuste (-)</option>
          <option value="TRANSFER_IN">Transferência (+)</option>
          <option value="TRANSFER_OUT">Transferência (-)</option>
          <option value="RETURN">Devolução</option>
        </Select>

        <Select value={productId || "ALL"} onChange={(e) => setProductId(e.target.value)} className="w-full sm:w-[220px]">
          <option value="ALL">Todos os Produtos</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
          ))}
        </Select>

        <Select value={warehouseId || "ALL"} onChange={(e) => setWarehouseId(e.target.value)} className="w-full sm:w-[180px]">
          <option value="ALL">Todos Almoxarifados</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </Select>

        <Button type="submit" className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
        {hasActiveFilters && (
          <Button type="button" variant="outline" onClick={clearFilters}>
            Limpar
          </Button>
        )}
      </div>
    </form>
  )
}
