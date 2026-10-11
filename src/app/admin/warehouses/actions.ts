"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireActionPermission } from "@/lib/action-guard"
import { logAudit } from "@/lib/audit"

export async function createWarehouseAction(formData: FormData) {
  const session = await requireActionPermission('CONFIG_MANAGE')

  const name = formData.get("name") as string
  const code = formData.get("code") as string
  const description = formData.get("description") as string
  const status = formData.get("status") as string

  const warehouse = await db.warehouse.create({
    data: { name, code, description, status }
  })

  await logAudit('CREATE', 'Warehouse', warehouse.id, { name, code }, session.userId)
  
  revalidatePath("/admin/warehouses")
  redirect("/admin/warehouses")
}

export async function updateWarehouseAction(formData: FormData) {
  const session = await requireActionPermission('CONFIG_MANAGE')

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const code = formData.get("code") as string
  const description = formData.get("description") as string
  const status = formData.get("status") as string

  await db.warehouse.update({
    where: { id },
    data: { name, code, description, status }
  })

  await logAudit('UPDATE', 'Warehouse', id, { name, code, status }, session.userId)

  revalidatePath("/admin/warehouses")
  revalidatePath(`/admin/warehouses/${id}`)
  redirect("/admin/warehouses")
}

export async function deleteWarehouseAction(formData: FormData) {
  const session = await requireActionPermission('CONFIG_MANAGE')

  const id = formData.get("id") as string
  await db.warehouse.delete({ where: { id } })

  await logAudit('DELETE', 'Warehouse', id, undefined, session.userId)

  revalidatePath("/admin/warehouses")
  redirect("/admin/warehouses")
}
