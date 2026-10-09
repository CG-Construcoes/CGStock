"use server"

import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

export async function deleteUserAction(userId: string) {
  const session = await getSession()
  if (!session || !session.roles?.includes("ADMIN")) {
    return { error: "Sem permissão." }
  }

  // Não pode excluir a si mesmo
  if (session.userId === userId) {
    return { error: "Você não pode excluir seu próprio usuário logado." }
  }

  try {
    await db.user.delete({
      where: { id: userId }
    })
    revalidatePath("/admin/users")
    return { success: true }
  } catch (error) {
    console.error("Erro ao excluir usuário:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return { 
          error: "Este usuário não pode ser excluído pois possui registros (como movimentações ou requisições) vinculados a ele.",
          hasHistory: true
        }
      }
    }
    
    // Fallback for when Prisma wraps it in UnknownRequestError
    const errorMsg = String(error)
    if (errorMsg.includes('violates RESTRICT setting') || errorMsg.includes('foreign key constraint')) {
      return { 
        error: "Este usuário não pode ser excluído pois possui registros (como movimentações ou requisições) vinculados a ele.",
        hasHistory: true 
      }
    }

    return { error: "Ocorreu um erro interno ao tentar excluir o usuário." }
  }
}

export async function softDeleteUserAction(userId: string) {
  const session = await getSession()
  if (!session || !session.roles?.includes("ADMIN")) {
    return { error: "Sem permissão." }
  }

  if (session.userId === userId) {
    return { error: "Você não pode excluir seu próprio usuário logado." }
  }

  try {
    // "Soft delete" + invalida sessões ativas do usuário
    await db.user.update({
      where: { id: userId },
      data: { status: "DELETED", sessionVersion: { increment: 1 } }
    })
    revalidatePath("/admin/users")
    return { success: true }
  } catch (error) {
    console.error("Erro ao fazer soft-delete no usuário:", error)
    return { error: "Ocorreu um erro ao inativar/apagar o usuário." }
  }
}
