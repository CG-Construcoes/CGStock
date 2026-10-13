import { BackButton } from "@/components/ui/back-button"
import { requirePageUser } from "@/lib/dal"
import { redirect } from "next/navigation"
import { NewWarehouseForm } from "./new-warehouse-form"

export const metadata = {
  title: "Novo Almoxarifado | CGStock",
}

export default async function NewWarehousePage() {
  const actor = await requirePageUser()
  if (!actor.ctx.roleNames.includes('ADMIN')) redirect('/unauthorized')
  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Novo Almoxarifado</h2>
          <p className="text-muted-foreground">Cadastre um novo galpão ou unidade física com sua localização inicial.</p>
        </div>
      </div>

      <NewWarehouseForm />
    </div>
  )
}
