/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Save, MapPin, Users, Loader2 } from "lucide-react"
import Link from "next/link"
import { createInventoryAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { useSyncUserId } from "@/components/sync-provider"
import { useRouter } from "next/navigation"

export default function InventoryForm({ warehouses, users, userId: propUserId }: any) {
  const syncUserId = useSyncUserId()
  const userId = propUserId || syncUserId || ""
  const router = useRouter()
  const [name, setName] = useState("")
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("")
  const [inventoryType, setInventoryType] = useState("PARTIAL")
  const [isPending, startTransition] = useTransition()

  const warehouse = warehouses.find((w: any) => w.id === selectedWarehouseId)
  const locations = warehouse?.locations || []

  const saveInventoryOffline = async (formData: FormData, locIds: string[], opIds: string[]) => {
    if (!userId) {
      toast.error("Usuário não identificado para operação offline.")
      return
    }
    const tempId = `offline-inv-${crypto.randomUUID()}`
    await queueOfflineOperation(
      "CREATE_INVENTORY",
      {
        name: String(formData.get("name") || name).trim(),
        warehouseId: selectedWarehouseId,
        type: inventoryType,
        locationIds: locIds,
        operatorIds: opIds,
      },
      userId,
      { clientTempId: tempId }
    )
    toast.success("Inventário criado no dispositivo! Você já pode realizar a contagem no Coletor sem internet.")
    router.push("/collector")
  }

  const handleSubmit = (formData: FormData) => {
    const locKeys = Array.from(formData.keys()).filter((k) => k.startsWith("loc_") && formData.get(k) === "on")
    const opKeys = Array.from(formData.keys()).filter((k) => k.startsWith("op_") && formData.get(k) === "on")

    if (locKeys.length === 0) {
      toast.error("Selecione pelo menos um local para contagem.")
      return
    }
    if (opKeys.length === 0) {
      toast.error("Selecione pelo menos um operador de coleta.")
      return
    }

    const locIds = locKeys.map((k) => k.replace("loc_", ""))
    const opIds = opKeys.map((k) => k.replace("op_", ""))

    startTransition(async () => {
      if (!navigator.onLine) {
        try {
          await saveInventoryOffline(formData, locIds, opIds)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erro ao salvar inventário offline.")
        }
        return
      }
      try {
        await createInventoryAction(formData)
      } catch (err: any) {
        if (err?.digest?.startsWith?.("NEXT_REDIRECT")) {
          throw err
        }
        if (!navigator.onLine || (err instanceof TypeError && /fetch|network/i.test(err.message))) {
          await saveInventoryOffline(formData, locIds, opIds)
          return
        }
        toast.error(err instanceof Error ? err.message : "Erro ao criar inventário.")
      }
    })
  }

  return (
    <div className="relative space-y-6">
      {isPending && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[2px] transition-all duration-200"
        >
          <div className="flex items-center gap-3 bg-card border border-primary/40 shadow-2xl px-6 py-4 rounded-full text-foreground backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {name.trim()
                ? `Criando e iniciando "${name.trim()}"...`
                : "Criando e iniciando inventário..."}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Novo Inventário</h2>
          <p className="text-muted-foreground">Configure uma nova contagem de estoque.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form
            action={handleSubmit}
            className={cn(
              "space-y-8 transition-all duration-200",
              isPending && "opacity-50 pointer-events-none select-none"
            )}
          >
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Informações Gerais</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Inventário *</label>
                  <Input
                    name="name"
                    placeholder="Ex: Conferência de Itens"
                    required
                    disabled={isPending}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Almoxarifado *</label>
                  <Select 
                    name="warehouseId" 
                    required 
                    disabled={isPending}
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Modo de Apuração *</label>
                  <Select
                    name="type"
                    disabled={isPending}
                    value={inventoryType}
                    onChange={(e) => setInventoryType(e.target.value)}
                  >
                    <option value="PARTIAL">Parcial / Amostragem (Apenas itens coletados)</option>
                    <option value="FULL">Geral Completo (Itens não coletados = 0)</option>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md border border-border">
                {inventoryType === "PARTIAL" ? (
                  <>
                    <strong>Modo Parcial / Amostragem (Recomendado):</strong> Gera divergência apenas para os produtos que forem bipados/coletados. Os demais produtos do almoxarifado permanecem inalterados.
                  </>
                ) : (
                  <>
                    <strong>Modo Geral Completo:</strong> Espera que 100% dos itens com saldo no local sejam contados. Qualquer item não bipado será considerado como falta total (contado = 0).
                  </>
                )}
              </p>
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
                        <input type="checkbox" name={`loc_${loc.id}`} defaultChecked disabled={isPending} className="rounded text-primary focus:ring-primary h-4 w-4" />
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
                    <input type="checkbox" name={`op_${u.id}`} disabled={isPending} className="rounded text-primary focus:ring-primary h-4 w-4" />
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
                <Button type="button" variant="outline" disabled={isPending}>Cancelar</Button>
              </Link>
              
              <Button
                type="submit"
                disabled={!selectedWarehouseId || locations.length === 0 || isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 min-w-[210px]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando Inventário...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Criar e Iniciar Inventário
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
