"use server"

import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/audit"

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

export type CategoryInput = { id?: string; name: string; description?: string | null; status?: string }

/** Cria ou edita a categoria direto na listagem (sem trocar de página). */
export async function saveCategoryAction(input: CategoryInput): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session) return { error: "Sessão expirada. Faça login novamente." }
  try {
    await requirePermission(input.id ? 'PRODUCT_UPDATE' : 'PRODUCT_CREATE')
  } catch {
    return { error: "Você não tem permissão para esta ação." }
  }

  const name = input.name?.trim()
  const description = input.description?.trim() || null
  const status = input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
  if (!name) return { error: "O nome da categoria é obrigatório." }

  const duplicate = await db.productCategory.findFirst({ where: { name, ...(input.id ? { id: { not: input.id } } : {}) } })
  if (duplicate) return { error: "Já existe uma categoria com este nome." }

  try {
    const category = input.id
      ? await db.productCategory.update({ where: { id: input.id }, data: { name, description, status } })
      : await db.productCategory.create({ data: { name, description, status } })
    await logAudit(input.id ? "UPDATE" : "CREATE", "ProductCategory", category.id, { name, description, status }, session.userId)
  } catch (error) {
    console.error(error)
    return { error: "Erro ao salvar a categoria." }
  }

  revalidatePath("/categories")
  revalidatePath("/products")
  return { success: true }
}
