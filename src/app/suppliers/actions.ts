"use server"

import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"

export async function createSupplierAction(formData: FormData) {
  const session = await getSession()
  if (!session) redirect("/login")
  await requirePermission('STOCK_ENTRY')

  const name = formData.get("name") as string
  const tradeName = formData.get("tradeName") as string || null
  const document = formData.get("document") as string || null
  const email = formData.get("email") as string || null
  const phone = formData.get("phone") as string || null
  const address = formData.get("address") as string || null
  const city = formData.get("city") as string || null
  const state = formData.get("state") as string || null
  const zipCode = formData.get("zipCode") as string || null
  const notes = formData.get("notes") as string || null

  if (!name) {
    redirect("/suppliers/new?error=missing_fields")
  }

  if (document) {
    const existing = await db.supplier.findUnique({ where: { document } })
    if (existing) {
      redirect("/suppliers/new?error=duplicate_document")
    }
  }

  try {
    await db.supplier.create({
      data: {
        name,
        tradeName,
        document,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        notes
      }
    })
  } catch (error) {
    console.error(error)
    redirect("/suppliers/new?error=create_failed")
  }

  redirect("/suppliers")
}
