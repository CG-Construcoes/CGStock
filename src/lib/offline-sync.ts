import { localDb, type SyncQueueTask, type SyncOperationType } from "./localdb"
import { applyOfflineOperationLocally } from "./offline-snapshot"

export const BACKGROUND_SYNC_TAG = "cgstock-offline-sync"

export const SYNC_ENDPOINT_MAP: Record<SyncOperationType, string> = {
  CREATE_RECEIPT: "/api/sync/receipt",
  CONFIRM_RECEIPT: "/api/sync/receipt-confirm",
  CREATE_REQUEST: "/api/sync/request",
  CREATE_ADJUSTMENT: "/api/sync/adjustment",
  CREATE_TRANSFER: "/api/sync/transfer",
  CREATE_RETURN: "/api/sync/return",
  CREATE_QUICK_ISSUE: "/api/sync/quick-issue",
  FULFILL_REQUEST: "/api/sync/fulfill",
  REQUEST_STATUS: "/api/sync/request-status",
  CREATE_INVENTORY: "/api/sync/inventory",
  SUBMIT_COLLECTION: "/api/sync",
}

const OPERATION_PRIORITY: Record<SyncOperationType, number> = {
  CREATE_RECEIPT: 10,
  CONFIRM_RECEIPT: 15,
  CREATE_RETURN: 20,
  CREATE_INVENTORY: 25,
  CREATE_REQUEST: 30,
  REQUEST_STATUS: 40,
  CREATE_ADJUSTMENT: 50,
  CREATE_TRANSFER: 60,
  SUBMIT_COLLECTION: 70,
  FULFILL_REQUEST: 80,
  CREATE_QUICK_ISSUE: 90,
}

export function sortSyncTasksWithDependencies(tasks: SyncQueueTask[]): SyncQueueTask[] {
  return [...tasks].sort((a, b) => {
    if (a.clientTempId && b.dependsOnEntityId === a.clientTempId) return -1
    if (b.clientTempId && a.dependsOnEntityId === b.clientTempId) return 1
    if (a.entityId && b.dependsOnEntityId === a.entityId) return -1
    if (b.entityId && a.dependsOnEntityId === b.entityId) return 1

    const timeA = new Date(a.createdAt).getTime()
    const timeB = new Date(b.createdAt).getTime()
    // Se criadas no mesmo intervalo de 2 segundos, respeita prioridade de dependência de estoque
    if (Math.abs(timeA - timeB) <= 2000) {
      const prioA = OPERATION_PRIORITY[a.operation] ?? 50
      const prioB = OPERATION_PRIORITY[b.operation] ?? 50
      if (prioA !== prioB) return prioA - prioB
    }
    if (timeA !== timeB) return timeA - timeB
    return (a.id ?? 0) - (b.id ?? 0)
  })
}

export function resolveDependentPayload(
  payload: Record<string, unknown>,
  idMappings: Map<string, string>
): Record<string, unknown> {
  if (idMappings.size === 0) return payload
  const cloned = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>
  for (const key of ["inventoryId", "requestId", "receiptId"]) {
    const val = cloned[key]
    if (typeof val === "string" && idMappings.has(val)) {
      cloned[key] = idMappings.get(val)!
    }
  }
  return cloned
}

export async function registerBackgroundSync() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
  try {
    const registration = await navigator.serviceWorker.ready
    if ("sync" in registration && registration.sync) {
      await (registration.sync as { register: (tag: string) => Promise<void> }).register(BACKGROUND_SYNC_TAG)
    }
  } catch {
    // Alguns navegadores mobile (iOS Safari) não suportam Background Sync API
  }
}

export async function queueOfflineOperation(
  operation: SyncQueueTask["operation"],
  payload: SyncQueueTask["payload"],
  userId: string,
  options?: {
    entityId?: string
    dependsOnEntityId?: string
    clientTempId?: string
  }
): Promise<string> {
  if (!localDb) throw new Error("IndexedDB not available")

  const serializedPayload = JSON.stringify(payload)
  const now = Date.now()

  // Evita duplicação acidental (ex: duplo clique rápido no botão de confirmar)
  const existingTasks = await localDb.syncQueue
    .where("userId")
    .equals(userId)
    .filter((t) => t.operation === operation && (t.status === "PENDING" || t.status === "SYNCING"))
    .toArray()

  const duplicate = existingTasks.find((t) => {
    if (options?.entityId && t.entityId === options.entityId && JSON.stringify(t.payload) === serializedPayload) {
      return true
    }
    const ageMs = now - new Date(t.createdAt).getTime()
    return ageMs >= 0 && ageMs < 8000 && JSON.stringify(t.payload) === serializedPayload
  })

  if (duplicate) {
    return duplicate.entityId
  }

  const entityId = options?.entityId || crypto.randomUUID()
  const detectedDependency =
    options?.dependsOnEntityId ||
    (typeof payload.inventoryId === "string" && payload.inventoryId.startsWith("offline-")
      ? payload.inventoryId
      : typeof payload.requestId === "string" && payload.requestId.startsWith("offline-")
      ? payload.requestId
      : typeof payload.receiptId === "string" && payload.receiptId.startsWith("offline-")
      ? payload.receiptId
      : undefined)

  await localDb.syncQueue.add({
    operation,
    entityId,
    userId,
    payload,
    status: "PENDING",
    attempts: 0,
    createdAt: new Date(),
    ...(detectedDependency ? { dependsOnEntityId: detectedDependency } : {}),
    ...(options?.clientTempId ? { clientTempId: options.clientTempId } : {}),
  })

  await applyOfflineOperationLocally(operation, payload, userId, options?.clientTempId || entityId)
  void registerBackgroundSync()

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cgstock:queue-updated"))
    if (navigator.onLine) {
      window.dispatchEvent(new Event("cgstock:sync"))
    }
  }

  return entityId
}
