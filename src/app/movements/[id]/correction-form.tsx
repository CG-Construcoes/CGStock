"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { PencilLine, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DecimalInput } from "@/components/ui/decimal-input"
import { Textarea } from "@/components/ui/textarea"
import { correctMovementAction } from "./actions"

export function CorrectionForm({ movementId, currentQuantity, unitCode }: { movementId: string; currentQuantity: number; unitCode: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const [newQuantity, setNewQuantity] = useState(String(currentQuantity))
  const [reason, setReason] = useState("")
  const [state, formAction, isPending] = useActionState(async (prev: Awaited<ReturnType<typeof correctMovementAction>>, formData: FormData) => {
    const result = await correctMovementAction(prev, formData)
    if (result?.success) {
      toast.success(result.success)
      setOpen(false)
      setReason("")
      router.refresh()
    }
    return result
  }, null)

  if (!open) {
    return (
      <Button variant="outline" onClick={() => { setNewQuantity(String(currentQuantity)); setOpen(true) }} className="gap-2">
        <PencilLine className="h-4 w-4" /> Corrigir lançamento
      </Button>
    )
  }

  return (
    <form action={formAction} className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-4">
      <input type="hidden" name="movementId" value={movementId} />
      <div>
        <p className="font-semibold text-foreground">Corrigir lançamento</p>
        <p className="text-sm text-muted-foreground">
          O lançamento original é mantido. O sistema registra a diferença como uma correção, com seu nome, data e motivo, e ajusta o saldo.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="currentQuantity">Quantidade atual</label>
          <Input id="currentQuantity" value={`${currentQuantity.toLocaleString("pt-BR")} ${unitCode}`} disabled />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="newQuantity">Quantidade correta *</label>
          <DecimalInput id="newQuantity" name="newQuantity" min={0} required suffix={unitCode} value={Number(newQuantity)} onValueChange={(v) => setNewQuantity(String(v))} disabled={isPending} autoFocus />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="reason">Motivo da correção *</label>
        <Textarea id="reason" name="reason" required minLength={5} rows={2} placeholder="Ex: quantidade digitada errada — nota fiscal indica 12 unidades" value={reason} onChange={(e) => setReason(e.target.value)} disabled={isPending} />
      </div>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
        <Button type="submit" disabled={isPending} className="min-w-36">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar correção"}
        </Button>
      </div>
    </form>
  )
}
