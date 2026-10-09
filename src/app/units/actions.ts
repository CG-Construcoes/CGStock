"use server"

import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"

export async function createUnitAction(formData: FormData) {
  const session = await getSession()
  if (!session) redirect("/login")
  await requirePermission('PRODUCT_CREATE')

  const code = formData.get("code") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string || null
  const status = formData.get("status") as string || "ACTIVE"

  if (!code || !name) {
    redirect("/units/new?error=Código e Nome são obrigatórios.")
  }

  const existing = await db.productUnit.findUnique({ where: { code } })
  if (existing) {
    redirect("/units/new?error=Já existe uma unidade com este código.")
  }

  try {
    await db.productUnit.create({
      data: { code, name, description, status }
    })
    
    // Registrar auditoria
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: "CREATE",
        entityType: "ProductUnit",
        entityId: code,
        metadata: { code, name, description, status }
      }
    })
  } catch (error) {
    console.error(error)
    redirect("/units/new?error=Erro ao criar unidade.")
  }

  redirect("/units")
}

export async function updateUnitAction(formData: FormData) {
  const session = await getSession()
  if (!session) redirect("/login")
  await requirePermission('PRODUCT_UPDATE')

  const id = formData.get("id") as string
  const code = formData.get("code") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string || null
  const status = formData.get("status") as string || "ACTIVE"

  if (!id || !code || !name) {
    redirect(`/units/${id}/edit?error=Dados inválidos.`)
  }

  const existing = await db.productUnit.findFirst({
    where: { code, id: { not: id } }
  })
  
  if (existing) {
    redirect(`/units/${id}/edit?error=Já existe outra unidade com este código.`)
  }

  try {
    await db.productUnit.update({
      where: { id },
      data: { code, name, description, status }
    })
    
    // Registrar auditoria
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: "UPDATE",
        entityType: "ProductUnit",
        entityId: id,
        metadata: { code, name, description, status }
      }
    })
  } catch (error) {
    console.error(error)
    redirect(`/units/${id}/edit?error=Erro ao atualizar unidade.`)
  }
  
  redirect("/units")
}
