import { db } from "@/lib/db"
import RequestForm from "./request-form"

export default async function NewRequestPage() {
  const warehouses = await db.warehouse.findMany({ where: { status: 'ACTIVE' } })
  const products = await db.product.findMany({ 
    where: { status: 'ACTIVE' },
    include: { unit: true } 
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <RequestForm 
        warehouses={JSON.parse(JSON.stringify(warehouses))} 
        products={JSON.parse(JSON.stringify(products))} 
      />
    </div>
  )
}
