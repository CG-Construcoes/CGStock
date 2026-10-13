import { createHash } from "node:crypto"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

export class SyncConflict extends Error {}

export function payloadHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

export function isSyncKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(value)
}

export function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export async function checkSyncReplay(userId: string, operation: string, idempotencyKey: string, hash: string) {
  const previous = await db.offlineSyncOperation.findUnique({
    where: { userId_operation_idempotencyKey: { userId, operation, idempotencyKey } }
  })
  if (!previous) return null
  return previous.payloadHash === hash ? "replayed" : "conflict"
}
