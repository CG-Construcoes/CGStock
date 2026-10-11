"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { requireAdmin } from "@/lib/action-guard"
import { logAuditStrict } from "@/lib/audit"
import bcrypt from "bcryptjs"
import crypto from "crypto"

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

  try {
    const rawPassword = crypto.randomBytes(6).toString("hex")
    const passwordHash = await bcrypt.hash(rawPassword, 10)
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    
    await db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: expiresAt,
          sessionVersion: { increment: 1 }
        }
      })
      await logAuditStrict("USER_PASSWORD_RESET", "User", user.id, {
        expiresAt
      }, session.userId, tx)
    })
    
    return { success: true, newPassword: rawPassword }
  } catch (error) {
    console.error("Erro ao resetar senha:", error)
    return { error: "Ocorreu um erro interno ao tentar resetar a senha." }
  }
}
