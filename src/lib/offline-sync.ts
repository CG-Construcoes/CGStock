import { localDb, type SyncQueueTask } from "./localdb"

export async function queueOfflineOperation(
  operation: SyncQueueTask['operation'],
  payload: SyncQueueTask['payload'],
  userId: string
) {
  if (!localDb) throw new Error("IndexedDB not available")

  await localDb.syncQueue.add({
    operation,
    entityId: crypto.randomUUID(),
    userId,
    payload,
    status: 'PENDING',
    attempts: 0,
    createdAt: new Date()
  })
}
