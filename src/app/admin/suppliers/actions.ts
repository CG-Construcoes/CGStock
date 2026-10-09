"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/action-guard"

export async function createSupplierAction(formData: FormData) {
  await requireAdmin()

  const name = formData.get("name") as string
  const tradeName = formData.get("tradeName") as string || null
  const document = formData.get("document") as string || null
  const email = formData.get("email") as string || null
  const phone = formData.get("phone") as string || null
  const status = formData.get("status") as string

  await db.supplier.create({
    data: { name, tradeName, document, email, phone, status }
  })
  
  revalidatePath("/admin/suppliers")
  redirect("/admin/suppliers")
}

export async function updateSupplierAction(formData: FormData) {
  await requireAdmin()

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const tradeName = formData.get("tradeName") as string || null
  const document = formData.get("document") as string || null
  const email = formData.get("email") as string || null
  const phone = formData.get("phone") as string || null
  const status = formData.get("status") as string

  await db.supplier.update({
    where: { id },
    data: { name, tradeName, document, email, phone, status }
  })

  revalidatePath("/admin/suppliers")
  revalidatePath(`/admin/suppliers/${id}`)
  redirect("/admin/suppliers")
}

export async function deleteSupplierAction(formData: FormData) {
  await requireAdmin()

  const id = formData.get("id") as string
  await db.supplier.delete({ where: { id } })
  revalidatePath("/admin/suppliers")
  redirect("/admin/suppliers")
}
