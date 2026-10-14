"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"
import { Save, MapPin, Info, Loader2 } from "lucide-react"
import { createWarehouseAction } from "../actions"
import { cn } from "@/lib/utils"

export function NewWarehouseForm() {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [createInitialLocation, setCreateInitialLocation] = useState(true)
  const [customLocCode, setCustomLocCode] = useState("")
  const [locName, setLocName] = useState("Estoque Geral")
  const [isPending, startTransition] = useTransition()

  // Sugere o código da localização baseado no código do almoxarifado
  const suggestedLocCode = code ? `${code.toUpperCase()}-GERAL` : "GERAL"
  const finalLocCode = customLocCode || suggestedLocCode

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await createWarehouseAction(formData)
    })
  }

  return (
    <div className="relative">
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
                ? `Criando almoxarifado "${name.trim()}"...`
                : "Criando novo almoxarifado..."}
            </span>
          </div>
        </div>
      )}

      <form
        action={handleSubmit}
        className={cn(
          "space-y-6 transition-all duration-200",
          isPending && "opacity-50 pointer-events-none select-none"
        )}
      >
        <Card className="border border-border shadow-xs">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg">Dados do Almoxarifado</CardTitle>
            <CardDescription className="text-xs">
              Informe os dados cadastrais básicos da unidade física.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Almoxarifado *</Label>
              <Input 
                id="name" 
                name="name" 
                required 
                disabled={isPending}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Almoxarifado Central" 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="code">Código do Almoxarifado *</Label>
              <Input 
                id="code" 
                name="code" 
                required 
                disabled={isPending}
                placeholder="Ex: ALM-CEN"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <p className="text-[11px] text-muted-foreground">
                Código de identificação curto e exclusivo para este galpão.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (Opcional)</Label>
              <Input 
                id="description" 
                name="description" 
                disabled={isPending}
                placeholder="Ex: Galpão principal de recebimento e expedição" 
              />
            </div>
            
            <input type="hidden" name="status" value="ACTIVE" />
          </CardContent>
        </Card>

        {/* Seção de Localização Inicial */}
        <Card className="border border-border shadow-xs bg-muted/20">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Localização Inicial</CardTitle>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary">
                <input
                  type="checkbox"
                  name="createInitialLocation"
                  value="true"
                  disabled={isPending}
                  checked={createInitialLocation}
                  onChange={(e) => setCreateInitialLocation(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-input text-primary focus:ring-primary"
                />
                Criar localização padrão agora
              </label>
            </div>
            <CardDescription className="text-xs mt-1">
              Todo almoxarifado precisa de pelo menos uma localização para poder receber materiais e planilhas de importação.
            </CardDescription>
          </CardHeader>

          {createInitialLocation && (
            <CardContent className="pt-6 space-y-4">
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Já criaremos automaticamente a primeira área física deste almoxarifado, deixando-o 100% pronto para importações imediatas.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initialLocationCode">Código da Localização *</Label>
                  <Input
                    id="initialLocationCode"
                    name="initialLocationCode"
                    value={customLocCode}
                    disabled={isPending}
                    placeholder={`Padrão: ${suggestedLocCode}`}
                    onChange={(e) => setCustomLocCode(e.target.value.toUpperCase())}
                    required={createInitialLocation}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Será criado como: <strong>{finalLocCode}</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initialLocationName">Nome da Localização *</Label>
                  <Input
                    id="initialLocationName"
                    name="initialLocationName"
                    value={locName}
                    disabled={isPending}
                    onChange={(e) => setLocName(e.target.value)}
                    placeholder="Ex: Estoque Geral"
                    required={createInitialLocation}
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="pt-2 flex justify-end gap-3">
          <BackButton />
          <Button type="submit" disabled={isPending} className="flex items-center gap-2 min-w-44">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando Almoxarifado...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Almoxarifado
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
