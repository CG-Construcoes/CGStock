"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { 
  MapPin, 
  Plus, 
  Zap, 
  AlertTriangle, 
  Trash2, 
  Box, 
  Loader2, 
  CheckCircle2,
  X
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { 
  createDefaultWarehouseLocationAction, 
  addLocationToWarehouseAction, 
  deleteWarehouseLocationAction 
} from "./actions"

interface LocationItem {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  _count: {
    stocks: number
    products: number
  }
}

interface WarehouseLocationsManagerProps {
  warehouseId: string
  warehouseName: string
  warehouseCode: string
  locations: LocationItem[]
  canCreate?: boolean
}

export function WarehouseLocationsManager({
  warehouseId,
  warehouseName,
  warehouseCode,
  locations,
  canCreate = true,
}: WarehouseLocationsManagerProps) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  
  const [isCreatingDefault, startDefaultTransition] = useTransition()
  const [isAddingLocation, startAddTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreateDefault = () => {
    startDefaultTransition(async () => {
      const res = await createDefaultWarehouseLocationAction(warehouseId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Localização padrão "${res.location?.code}" criada com sucesso!`)
        router.refresh()
      }
    })
  }

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) {
      toast.error("Preencha o código e o nome da localização.")
      return
    }

    startAddTransition(async () => {
      const res = await addLocationToWarehouseAction({
        warehouseId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
      })

      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Localização "${name}" adicionada com sucesso!`)
        setIsModalOpen(false)
        setCode("")
        setName("")
        setDescription("")
        router.refresh()
      }
    })
  }

  const handleDeleteLocation = (locationId: string, locationCode: string) => {
    if (!confirm(`Tem certeza que deseja excluir a localização "${locationCode}"?`)) return

    setDeletingId(locationId)
    startAddTransition(async () => {
      const res = await deleteWarehouseLocationAction(locationId, warehouseId)
      setDeletingId(null)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Localização "${locationCode}" excluída com sucesso!`)
        router.refresh()
      }
    })
  }

  return (
    <Card className="border border-border shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Localizações do Almoxarifado ({locations.length})
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Mapeie as áreas físicas de armazenagem (corredores, estantes ou estoque geral) para este galpão.
          </CardDescription>
        </div>

        {canCreate && (
          <div className="flex items-center gap-2">
            {locations.length === 0 && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleCreateDefault}
                disabled={isCreatingDefault}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                {isCreatingDefault ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Criar Local Padrão
                  </>
                )}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCode(`${warehouseCode}-`)
                setIsModalOpen(true)
              }}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Nova Localização
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {locations.length === 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-900 dark:text-amber-200 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  Almoxarifado sem nenhuma localização cadastrada!
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Operações de <strong>Entrada</strong>, <strong>Transferência</strong> e <strong>Importação de Planilhas</strong> exigem ao menos uma localização para armazenar os itens físicos.
                </p>
              </div>
            </div>

            {canCreate && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateDefault}
                  disabled={isCreatingDefault}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-xs font-semibold"
                >
                  {isCreatingDefault ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Criar Localização Geral Padrão Agora
                </Button>
                <span className="text-xs text-muted-foreground">
                  (Irá gerar automaticamente o código <code>{warehouseCode}-GERAL</code> com o nome &ldquo;Estoque Geral&rdquo;)
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{loc.name}</span>
                      <span className="text-[11px] font-mono font-medium px-2 py-0.5 bg-muted rounded border border-border">
                        {loc.code}
                      </span>
                    </div>
                    {loc.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {loc.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Box className="h-3.5 w-3.5" />
                    <span>{loc._count.stocks} lotes</span>
                  </div>

                  <Badge
                    variant={loc.status === "ACTIVE" ? "success" : "secondary"}
                    className="text-[10px]"
                  >
                    {loc.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </Badge>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteLocation(loc.id, loc.code)}
                    disabled={deletingId === loc.id}
                    className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Excluir localização"
                  >
                    {deletingId === loc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Modal para Adicionar Localização */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Nova Localização</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddLocation} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="loc-code">Código da Posição / Local *</Label>
                <Input
                  id="loc-code"
                  placeholder={`Ex: ${warehouseCode}-A01 ou GERAL`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Identificador único (ex: Prateleira, Corredor, Gaveta ou GERAL).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loc-name">Nome da Localização *</Label>
                <Input
                  id="loc-name"
                  placeholder="Ex: Corredor A - Prateleira 01 ou Estoque Geral"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loc-desc">Descrição (Opcional)</Label>
                <Input
                  id="loc-desc"
                  placeholder="Informações adicionais de acesso ou capacidade"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isAddingLocation}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isAddingLocation}
                  className="flex items-center gap-2"
                >
                  {isAddingLocation ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Adicionar Localização
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  )
}
