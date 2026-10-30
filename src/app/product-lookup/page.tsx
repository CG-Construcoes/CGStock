import { requirePageAnyPermission, resolveWarehouseContext } from "@/lib/dal"
import { ProductLookupClient } from "./product-lookup-client"

export const metadata = {
  title: "Consulta de Produto | CGStock",
}

export default async function ProductLookupPage() {
  const user = await requirePageAnyPermission("STOCK_VIEW", "PRODUCT_VIEW")
  const { warehouses, selectedWarehouseId } = await resolveWarehouseContext(undefined, user.session.userId)

  const warehouseLabel = selectedWarehouseId
    ? warehouses.find((w) => w.id === selectedWarehouseId)?.name ?? "Almoxarifado selecionado"
    : `Todos os almoxarifados (${warehouses.length})`

  return (
    <ProductLookupClient
      userId={user.session.userId}
      activeWarehouseId={selectedWarehouseId}
      warehouseLabel={warehouseLabel}
    />
  )
}
