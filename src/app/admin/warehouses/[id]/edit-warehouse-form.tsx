"use client"

import { useActionState } from "react"
import { Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { BackButton } from "@/components/ui/back-button"
import { updateWarehouseAction } from "../actions"
import { WarehouseFields, FormError, type WarehouseFieldValues } from "../warehouse-fields"

export function EditWarehouseForm({ warehouse }: { warehouse: WarehouseFieldValues & { id: string; status: string } }) {
  const [state, formAction, isPending] = useActionState(updateWarehouseAction, null)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={warehouse.id} />

      <WarehouseFields key={state?.at} defaults={state?.values ?? warehouse} disabled={isPending} />

      <div className="space-y-2">
        <Label htmlFor="status">Status Operacional</Label>
        <select
          id="status"
          name="status"
          defaultValue={warehouse.status}
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
        </select>
      </div>

      <FormError message={state?.error} />

      <div className="pt-4 flex justify-end gap-2 border-t border-border">
        <BackButton />
        <Button type="submit" disabled={isPending} className="flex items-center gap-2">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Alterações
        </Button>
      </div>
    </form>
  )
}
