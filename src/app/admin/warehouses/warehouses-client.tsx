"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, PackageOpen, Box, Edit, MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { WarehouseDeleteDialog } from "./warehouse-delete-dialog"

interface WarehouseItem {
  id: string
  name: string
  code: string
  description: string | null
  status: string
  _count: {
    locations: number
    stocks: number
  }
}

export function WarehousesClient({ warehouses }: { warehouses: WarehouseItem[] }) {
  const [search, setSearch] = useState("")

  const filtered = warehouses.filter((w) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      w.name.toLowerCase().includes(q) ||
      w.code.toLowerCase().includes(q) ||
      (w.description && w.description.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl border border-border shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar almoxarifado por código, nome ou descrição..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-card border border-border rounded-xl p-8">
            <PackageOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-lg text-foreground">Nenhum almoxarifado encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Tente buscar com outro termo." : "Cadastre um novo almoxarifado para começar."}
            </p>
          </div>
        ) : (
          filtered.map((warehouse) => (
            <Card
              key={warehouse.id}
              className="group hover:border-primary/50 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden"
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="w-full flex items-center justify-between mb-4">
                  <Badge
                    variant={warehouse.status === "ACTIVE" ? "success" : "secondary"}
                    className="text-[11px]"
                  >
                    {warehouse.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </Badge>

                  <div className="flex items-center gap-1">
                    <Link href={`/admin/warehouses/${warehouse.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Editar almoxarifado"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <WarehouseDeleteDialog
                      warehouseId={warehouse.id}
                      warehouseName={warehouse.name}
                      warehouseCode={warehouse.code}
                      variant="icon"
                    />
                  </div>
                </div>

                <div className="h-14 w-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <PackageOpen className="h-7 w-7" />
                </div>

                <h3 className="font-bold text-lg text-foreground line-clamp-1">{warehouse.name}</h3>
                <p className="text-xs font-mono font-medium text-muted-foreground mb-2 px-2 py-0.5 bg-muted rounded-md mt-1">
                  {warehouse.code}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                  {warehouse.description || "Sem descrição"}
                </p>

                <div className="w-full flex items-center justify-between border-t border-border pt-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Box className="h-4 w-4 text-primary" />
                    <span>{warehouse._count.stocks} lotes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{warehouse._count.locations} locais</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
