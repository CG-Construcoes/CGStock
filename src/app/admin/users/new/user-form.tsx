"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createUserAction } from "./actions"
import { AlertCircle, Loader2 } from "lucide-react"

export function UserForm({ roles, warehouses }: { roles: { id: string, name: string }[], warehouses: { id: string, name: string, code: string }[] }) {
  const [state, action, isPending] = useActionState(createUserAction, null)
  const [accessMode, setAccessMode] = useState('NONE')

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2 border border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nome Completo</Label>
        <Input 
          id="name" 
          name="name" 
          placeholder="Ex: Carlos Silva" 
          required 
          className="bg-muted/50 focus-visible:ring-primary border-border"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail Corporativo</Label>
        <Input 
          id="email" 
          name="email" 
          type="email" 
          placeholder="carlos@cgconstrucoes.com" 
          required 
          className="bg-muted/50 focus-visible:ring-primary border-border"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="password">Senha Inicial</Label>
          <Input 
            id="password" 
            name="password" 
            type="password" 
            placeholder="Mínimo 6 caracteres" 
            required 
            minLength={6}
            className="bg-muted/50 focus-visible:ring-primary border-border"
          />
        </div>

        <div className="space-y-2">
          <Label>Tipo de Senha</Label>
          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" name="mustChangePassword" value="true" defaultChecked className="text-primary focus:ring-primary" />
              <span>Temporária (Exige troca no login)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" name="mustChangePassword" value="false" className="text-primary focus:ring-primary" />
              <span>Fixa</span>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Perfis de Acesso</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-4 rounded-md border border-border">
          {roles.map(role => (
            <label key={role.id} className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  name="roleIds" 
                  value={role.id} 
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-primary/50 checked:border-primary checked:bg-primary "
                />
                <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-medium text-foreground group-hover:text-primary ">
                {role.name}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Selecione um ou mais perfis. Eles definem os acessos deste usuário no sistema e no coletor.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Almoxarifados Autorizados</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Tipo de acesso aos almoxarifados">
          {([['NONE', 'Nenhum'], ['SELECTED', 'Selecionados'], ['ALL', 'Todos, inclusive futuros']] as const).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm cursor-pointer">
              <input type="radio" name="warehouseAccessMode" value={value} checked={accessMode === value} onChange={() => setAccessMode(value)} />
              {label}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-4">
          {warehouses.map(wh => (
            <label key={wh.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="warehouseIds" value={wh.id} disabled={accessMode !== 'SELECTED'} />
              {wh.name} <span className="text-muted-foreground">({wh.code})</span>
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-muted/50 text-primary-foreground shadow-sm  active:scale-95">
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Criando usuário...
          </>
        ) : (
          "Cadastrar Usuário"
        )}
      </Button>
    </form>
  )
}
