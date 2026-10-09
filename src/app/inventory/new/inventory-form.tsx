/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {  Save, MapPin, Users } from "lucide-react"
import Link from "next/link"
import { createInventoryAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"

export default function InventoryForm({ warehouses, users }: any) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("")

  const warehouse = warehouses.find((w: any) => w.id === selectedWarehouseId)
  const locations = warehouse?.locations || []

  return (
    <>
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Novo Inventário</h2>
          <p className="text-muted-foreground">Configure uma nova contagem de estoque.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form action={createInventoryAction} className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Informações Gerais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Inventário *</label>
                  <Input name="name" placeholder="Ex: Inventário Geral 2026" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Almoxarifado *</label>
                  <Select 
                    name="warehouseId" 
                    required 
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" /> Locais a Contar
              </h3>
              <p className="text-sm text-muted-foreground">Selecione os corredores ou posições que farão parte desta contagem.</p>
              
              {selectedWarehouseId ? (
                locations.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted p-4 rounded-lg border">
                    {locations.map((loc: any) => (
                      <label key={loc.id} className="flex items-center gap-2 bg-card p-3 rounded-md border cursor-pointer hover:bg-primary/5">
                        <input type="checkbox" name={`loc_${loc.id}`} defaultChecked className="rounded text-primary focus:ring-primary h-4 w-4" />
                        <span className="font-medium text-sm">{loc.code}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-amber-600 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    Este almoxarifado não possui localizações cadastradas.
                  </div>
                )
              ) : (
                <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg border">
                  Selecione um almoxarifado primeiro.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" /> Operadores de Coleta
              </h3>
              <p className="text-sm text-muted-foreground">Selecione os usuários que usarão o coletor neste inventário.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-muted p-4 rounded-lg border">
                {users.map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2 bg-card p-3 rounded-md border cursor-pointer hover:bg-primary/5">
                    <input type="checkbox" name={`op_${u.id}`} className="rounded text-primary focus:ring-primary h-4 w-4" />
                    <div>
                      <span className="font-medium text-sm block">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.roles.map((r: any) => r.name).join(', ')}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Link href="/inventory">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              
              <Button type="submit" disabled={!selectedWarehouseId || locations.length === 0} className="bg-primary hover:bg-primary text-white flex items-center gap-2">
                <Save className="h-4 w-4" />
                Criar e Iniciar Inventário
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
