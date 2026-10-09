"use server"

import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"

export async function createCategoryAction(formData: FormData) {
  const session = await getSession()
  if (!session) redirect("/login")
  await requirePermission('PRODUCT_CREATE')

  const name = formData.get("name") as string
  const description = formData.get("description") as string || null
  const status = formData.get("status") as string || "ACTIVE"

  if (!name) {
    redirect("/categories/new?error=O nome da categoria é obrigatório.")
  }

  const existing = await db.productCategory.findUnique({ where: { name } })
  if (existing) {
    redirect("/categories/new?error=Já existe uma categoria com este nome.")
  }

  try {
    await db.productCategory.create({
      data: { name, description, status }
    })
    
    // Registrar auditoria
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: "CREATE",
        entityType: "ProductCategory",
        entityId: name,
        metadata: { name, description, status }
      }
    })
  } catch (error) {
    console.error(error)
    redirect("/categories/new?error=Erro ao criar categoria.")
  }

  redirect("/categories")
}

export async function updateCategoryAction(formData: FormData) {
  const session = await getSession()
  if (!session) redirect("/login")
  await requirePermission('PRODUCT_UPDATE')

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string || null
  const status = formData.get("status") as string || "ACTIVE"

  if (!id || !name) {
    redirect(`/categories/${id}/edit?error=Dados inválidos.`)
  }

  const existing = await db.productCategory.findFirst({
    where: { name, id: { not: id } }
  })
  
  if (existing) {
    redirect(`/categories/${id}/edit?error=Já existe outra categoria com este nome.`)
  }

  try {
    await db.productCategory.update({
      where: { id },
      data: { name, description, status }
    })
    
    // Registrar auditoria
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: "UPDATE",
        entityType: "ProductCategory",
        entityId: id,
        metadata: { name, description, status }
      }
    })
  } catch (error) {
    console.error(error)
    redirect(`/categories/${id}/edit?error=Erro ao atualizar categoria.`)
  }
  
  redirect("/categories")
}
