"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HardHat } from "lucide-react"
import { BUSINESS_CENTER_PATTERN } from "@/lib/business-center"

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

export type WarehouseFieldValues = {
  name?: string
  code?: string
  source?: string | null
  description?: string | null
  engineerName?: string | null
  engineerEmail?: string | null
}

export function WarehouseFields({
  defaults = {},
  disabled,
  onNameChange,
  onCodeChange,
}: {
  defaults?: WarehouseFieldValues
  disabled?: boolean
  onNameChange?: (value: string) => void
  onCodeChange?: (value: string) => void
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">Nome do Almoxarifado *</Label>
        <Input id="name" name="name" required disabled={disabled} defaultValue={defaults.name} onChange={(e) => onNameChange?.(e.target.value)} placeholder="Ex: Cg - Estoque Almoxarifado Central" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Código do Centro de Negócio (Informakon) *</Label>
        <Input
          id="code"
          name="code"
          required
          disabled={disabled}
          defaultValue={defaults.code}
          pattern={BUSINESS_CENTER_PATTERN}
          title="Formato AAA.BB.CCCC — ex: CGC.01.0114"
          placeholder="Ex: CGC.01.0114"
          className="font-mono uppercase"
          onChange={(e) => {
            e.target.value = e.target.value.toUpperCase()
            onCodeChange?.(e.target.value)
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          Use exatamente o código do Informakon (AAA.BB.CCCC). Ele vai na coluna &quot;Cód Centro de Negócio&quot; das planilhas de importação.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="source">Empresa (ERP)</Label>
        <select id="source" name="source" disabled={disabled} defaultValue={defaults.source ?? "CV"} className={selectClass}>
          <option value="MGA">MGA — CG Construções</option>
          <option value="CV">CV — Conceito</option>
          <option value="">Sem vínculo</option>
        </select>
        <p className="text-[11px] text-muted-foreground">
          Define qual base de fornecedores aparece nas entradas deste almoxarifado.
        </p>
      </div>

      <fieldset className="rounded-md border border-border p-4 space-y-4">
        <legend className="px-1.5 text-sm font-semibold flex items-center gap-2">
          <HardHat className="h-4 w-4 text-primary" /> Engenheiro Responsável
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="engineerName">Nome *</Label>
            <Input id="engineerName" name="engineerName" required disabled={disabled} defaultValue={defaults.engineerName ?? ""} placeholder="Nome completo" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="engineerEmail">E-mail *</Label>
            <Input id="engineerEmail" name="engineerEmail" type="email" required disabled={disabled} defaultValue={defaults.engineerEmail ?? ""} placeholder="engenheiro@cgconstrucoes.com" />
          </div>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição (Opcional)</Label>
        <Input id="description" name="description" disabled={disabled} defaultValue={defaults.description ?? ""} placeholder="Ex: Galpão principal de recebimento e expedição" />
      </div>
    </>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return <div role="alert" className="p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">{message}</div>
}
