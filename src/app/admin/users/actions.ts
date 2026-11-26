"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { requireAdmin } from "@/lib/action-guard"
import { logAuditStrict } from "@/lib/audit"
import { ADMIN_RESET_TTL_MINUTES, sendPasswordResetEmail } from "@/lib/password-reset"

export async function deleteUserAction(userId: string) {
  let session
  try {
    session = await requireAdmin()
  } catch {
    return { error: "Sem permissão." }
  }

  // Não pode excluir a si mesmo
  if (session.userId === userId) {
    return { error: "Você não pode excluir seu próprio usuário logado." }
  }

  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.delete({ where: { id: userId } })
      await logAuditStrict("USER_DELETED", "User", user.id, {
        name: user.name,
        email: user.email
      }, session.userId, tx)
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
  let session
  try {
    session = await requireAdmin()
  } catch {
    return { error: "Sem permissão." }
  }

  if (session.userId === userId) {
    return { error: "Você não pode excluir seu próprio usuário logado." }
  }

  try {
    // "Soft delete" + invalida sessões ativas do usuário
    await db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { status: "DELETED", sessionVersion: { increment: 1 } }
      })
      await logAuditStrict("USER_DEACTIVATED", "User", user.id, {
        name: user.name,
        email: user.email
      }, session.userId, tx)
    })
    revalidatePath("/admin/users")
    return { success: true }
  } catch (error) {
    console.error("Erro ao fazer soft-delete no usuário:", error)
    return { error: "Ocorreu um erro ao inativar/apagar o usuário." }
  }
}

export async function resetPasswordAction(userId: string) {
  let session
  try {
    session = await requireAdmin()
  } catch {
    return { error: "Sem permissão." }
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return { error: "Usuário não encontrado." }
  if (!user.email) return { error: "Este usuário não possui e-mail cadastrado. Cadastre um e-mail antes de resetar a senha." }
  if (!user.loginEnabled || user.status !== "ACTIVE") return { error: "Este usuário está sem acesso ao sistema ou inativo." }

  try {
    await sendPasswordResetEmail({ ...user, email: user.email }, ADMIN_RESET_TTL_MINUTES)
    await logAuditStrict("USER_PASSWORD_RESET", "User", user.id, { via: "email-link", sentTo: user.email }, session.userId)
    return { success: true, email: user.email }
  } catch (error) {
    console.error("Erro ao enviar e-mail de redefinição:", error)
    return { error: "Não foi possível enviar o e-mail de redefinição. Tente novamente em alguns minutos." }
  }
}
