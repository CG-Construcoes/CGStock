import { db } from "./db"
import { getSession } from "./auth"
import { headers } from "next/headers"
import { Prisma } from "@prisma/client"

type AuditTx = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export async function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
  overrideUserId?: string, // Útil quando a própria action de login falhar/sucesso, e não temos sessão via cookie
  tx?: AuditTx // Quando fornecido, o log participa da mesma transação da operação
) {
  try {
    let userId = overrideUserId
    let ip = ""
    let userAgent = ""

    if (!userId) {
      const session = await getSession()
      if (session) {
        userId = session.userId
      }
    }

    // Se ainda não tivermos userId, é uma ação anônima ou do sistema. Podemos definir como SYSTEM ou omitir (mas o schema exige userId, então podemos usar um mock ou falhar silenciosamente).
    // Para contornar, em cenários críticos sem usuário (jobs), deveríamos ter um userId do sistema. 
    // Como a regra diz para não falhar, se não houver usuário a gente ignora ou logamos com um fallback caso suportado. 
    // Vamos garantir que sempre passaremos um usuário ou teremos sessão.
    if (!userId) {
      console.warn("Audit log rejected due to missing userId", { action, entityType, entityId })
      return
    }

    try {
      const headersList = await headers()
      ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || ""
      userAgent = headersList.get('user-agent') || ""
    } catch {
      // Ignorar caso de erro ao pegar headers (ex: background jobs)
    }

    const client = tx || db
    await client.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata ? metadata : undefined,
        ip,
        userAgent,
      }
    })
  } catch (error) {
    // Audit log não deve quebrar o fluxo principal
    console.error("Failed to write audit log:", error)
  }
}

/**
 * Variante estrita: propaga erros. Usar em operações críticas e dentro de
 * transações, onde a perda do registro de auditoria faria a operação inteira
 * falhar (e reverter) em vez de seguir sem rastreabilidade.
 */
export async function logAuditStrict(
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
  overrideUserId?: string,
  tx?: AuditTx
) {
  let userId = overrideUserId
  if (!userId) {
    const session = await getSession()
    if (session) userId = session.userId
  }
  if (!userId) throw new Error(`Auditoria obrigatória sem usuário identificado (${action}).`)

  let ip = ""
  let userAgent = ""
  try {
    const headersList = await headers()
    ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || ""
    userAgent = headersList.get('user-agent') || ""
  } catch {
    // headers indisponíveis fora de requisição (jobs/scripts)
  }

  const client = tx || db
  await client.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      metadata: metadata ? metadata : undefined,
      ip,
      userAgent,
    }
  })
}
