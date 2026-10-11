"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Plus, PackageX } from "lucide-react"

type ReturnProduct = { id: string; code: string; name: string; unitId: string | null }
type ReturnWarehouse = { locations: { id: string; code: string }[] }

export function ReturnItemsForm({ products, warehouses }: { products: ReturnProduct[], warehouses: ReturnWarehouse[] }) {
  const idCounter = useRef(1)
  const [items, setItems] = useState([{ id: 0 }])

  const addItem = () => {
    setItems(prev => [...prev, { id: idCounter.current++ }])
  }

  const removeItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id))
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium border-b pb-2 flex items-center justify-between">
        Itens a Devolver
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={addItem}>
          <Plus className="h-4 w-4" /> Adicionar Item
        </Button>
      </h3>
      
      {items.map((item) => (
        <div key={item.id} className="border rounded-lg p-4 bg-muted flex items-start gap-4">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-medium">Produto</label>
              {/* Added standard styling and size for large selects to make it look better */}
              <select name="productId" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 max-h-48 overflow-y-auto">
                <option value="">Selecione...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Qtd</label>
              <Input type="number" step="0.0001" name="quantity" defaultValue={1} min={0.0001} required />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-medium">Condição</label>
              <Select name="condition" defaultValue="GOOD">
                <option value="GOOD">Bom Estado (Retorna p/ Estoque)</option>
                <option value="DAMAGED">Danificado (Fica segregado)</option>
                <option value="UNUSABLE">Inutilizável (Descarte)</option>
              </Select>
            </div>
            <div className="col-span-5 space-y-2">
              <label className="text-xs font-medium">Localização no Almoxarifado</label>
              <Select name="locationId" required>
                <option value="">Selecione o local de guarda...</option>
                {warehouses.flatMap(w => w.locations).map(l => (
                  <option key={l.id} value={l.id}>{l.code}</option>
                ))}
              </Select>
            </div>
            <input type="hidden" name="unitId" value={products[0]?.unitId || ''} />
          </div>
          {items.length > 1 && (
            <Button type="button" variant="ghost" onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6">
              <PackageX className="h-5 w-5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
