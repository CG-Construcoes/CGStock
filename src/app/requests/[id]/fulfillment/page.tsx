import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import FulfillmentForm from "./fulfillment-form"

export default async function FulfillmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const req = await db.materialRequest.findUnique({
    where: { id },
    include: {
      requester: true,
      warehouse: true,
      items: {
        include: {
          product: { 
            include: { 
              stocks: {
                include: { location: true }
              } 
            } 
          },
          unit: true
        }
      }
    }
  })

  if (!req) notFound()

  // Serializa o objeto para remover instâncias de classes (como Decimal do Prisma)
  // que não podem ser passadas para Client Components.
  const serializedReq = JSON.parse(JSON.stringify(req))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <FulfillmentForm request={serializedReq} />
    </div>
  )
}
