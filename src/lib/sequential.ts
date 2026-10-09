import { Prisma } from "@prisma/client"

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

const MAX_ATTEMPTS = 5

/**
 * Cria um registro com numeração sequencial tolerante a concorrência.
 * `computeNumber` recebe a tentativa (0-based) e deve retornar um número
 * candidato; `create` persiste usando o número. Em caso de violação de
 * unicidade (P2002), tenta novamente com o próximo número.
 */
export async function createWithUniqueNumber<T>(
  computeNumber: (attempt: number) => Promise<string>,
  create: (number: string) => Promise<T>
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const number = await computeNumber(attempt)
    try {
      return await create(number)
    } catch (error) {
      if (isUniqueViolation(error)) {
        lastError = error
        continue
      }
      throw error
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Falha ao gerar número sequencial único.")
}
