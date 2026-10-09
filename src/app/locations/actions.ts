"use server"

import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"

export async function createLocationAction(formData: FormData) {
  const session = await getSession()
  if (!session) redirect("/login")
  await requirePermission('CONFIG_MANAGE')

  const warehouseId = formData.get("warehouseId") as string
  const code = formData.get("code") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string || null
  const status = formData.get("status") as string || "ACTIVE"
  const parentId = formData.get("parentId") as string || null

  if (!warehouseId || !code || !name) {
    redirect("/locations/new?error=Armazém, Código e Nome são obrigatórios.")
  }

  // Verifica duplicação de código em qualquer lugar ou só no mesmo warehouse?
  // O schema diz `code String @unique`, então é único no sistema todo
  const existing = await db.warehouseLocation.findUnique({ where: { code } })
  if (existing) {
    redirect("/locations/new?error=Já existe uma localização com este código.")
  }

  // Validação de hierarquia: se tem parentId, o pai deve pertencer ao mesmo warehouse
  if (parentId) {
    const parent = await db.warehouseLocation.findUnique({ where: { id: parentId } })
    if (!parent) {
      redirect("/locations/new?error=Localização pai não encontrada.")
    }
    if (parent.warehouseId !== warehouseId) {
      redirect("/locations/new?error=A localização pai deve pertencer ao mesmo almoxarifado.")
    }
  }

  try {
    await db.warehouseLocation.create({
      data: { warehouseId, code, name, description, status, parentId }
    })
    
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: "CREATE",
        entityType: "WarehouseLocation",
        entityId: code,
        metadata: { warehouseId, code, name, description, status, parentId }
      }
    })
  } catch (error) {
    console.error(error)
    redirect("/locations/new?error=Erro ao criar localização.")
  }

  redirect("/locations")
}

export async function updateLocationAction(formData: FormData) {
  const session = await getSession()
  if (!session) redirect("/login")
  await requirePermission('CONFIG_MANAGE')

  const id = formData.get("id") as string
  const warehouseId = formData.get("warehouseId") as string
  const code = formData.get("code") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string || null
  const status = formData.get("status") as string || "ACTIVE"
  const parentId = formData.get("parentId") as string || null

  if (!id || !warehouseId || !code || !name) {
    redirect(`/locations/${id}/edit?error=Dados inválidos.`)
  }

  const existing = await db.warehouseLocation.findFirst({
    where: { code, id: { not: id } }
  })
  if (existing) {
    redirect(`/locations/${id}/edit?error=Já existe outra localização com este código.`)
  }

  if (parentId === id) {
    redirect(`/locations/${id}/edit?error=Uma localização não pode ser filha dela mesma.`)
  }

  if (parentId) {
    const parent = await db.warehouseLocation.findUnique({ where: { id: parentId } })
    if (!parent) {
      redirect(`/locations/${id}/edit?error=Localização pai não encontrada.`)
    }
    if (parent.warehouseId !== warehouseId) {
      redirect(`/locations/${id}/edit?error=A localização pai deve pertencer ao mesmo almoxarifado.`)
    }
    
    // Evitar ciclo: verificar se o parentId é filho desta localização
    // Para simplificar, não permitimos que o novo pai seja nenhum dos descendentes diretos
    // Para uma validação completa de árvore, seria preciso buscar todos os filhos recursivamente,
    // mas vamos verificar se o parent já tem este item na árvore subindo
    let currentParent = parent.parentId
    while(currentParent) {
      if (currentParent === id) {
         redirect(`/locations/${id}/edit?error=Ciclo detectado na hierarquia. O pai escolhido está dentro desta mesma localização.`)
      }
      const ancestor = await db.warehouseLocation.findUnique({ where: { id: currentParent }})
      currentParent = ancestor?.parentId || null
    }
  }

  // Se estiver inativando, verifica se há estoque positivo
  if (status === "INACTIVE") {
    const stock = await db.stock.aggregate({
      where: { locationId: id },
      _sum: { quantity: true }
    })
    
    if (stock._sum.quantity && stock._sum.quantity > 0) {
      redirect(`/locations/${id}/edit?error=Não é possível inativar uma localização que possui itens em estoque.`)
    }
  }

  try {
    await db.warehouseLocation.update({
      where: { id },
      data: { warehouseId, code, name, description, status, parentId }
    })
    
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: "UPDATE",
        entityType: "WarehouseLocation",
        entityId: id,
        metadata: { warehouseId, code, name, description, status, parentId }
      }
    })
  } catch (error) {
    console.error(error)
    redirect(`/locations/${id}/edit?error=Erro ao atualizar localização.`)
  }
  
  redirect("/locations")
}
