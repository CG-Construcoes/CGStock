"use client"

import { Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

export function StockFilterForm({ q, selectedWarehouseId, warehouses }: { q: string, selectedWarehouseId: string, warehouses: { id: string, name: string }[] }) {
  const router = useRouter()

  const handleFilter = (form: HTMLFormElement) => {
    const formData = new FormData(form)
    const searchParams = new URLSearchParams()
    
    const query = formData.get("q") as string
    const wId = formData.get("warehouseId") as string
    
    if (query) searchParams.set("q", query)
    if (wId) searchParams.set("warehouseId", wId)
      
    router.push(`/stock?${searchParams.toString()}`)
  }

  return (
    <form 
      className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-md border border-border shadow-sm"
      onSubmit={(e) => {
        e.preventDefault()
        handleFilter(e.currentTarget)
      }}
    >
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          name="q" 
          defaultValue={q} 
          placeholder="Buscar por cód. insumo ou produto..." 
          className="pl-9" 
        />
      </div>
      <div className="w-full sm:w-64">
        <select 
          name="warehouseId" 
          defaultValue={selectedWarehouseId}
          onChange={(e) => {
            if (e.target.form) handleFilter(e.target.form)
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">Todos os Almoxarifados</option>
          {warehouses.map((w: any) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="outline" className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
      </div>
    </form>
  )
}
