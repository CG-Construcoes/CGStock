import { localDb, type SyncQueueTask } from "./localdb"

export async function queueOfflineOperation(
  operation: SyncQueueTask['operation'],
  payload: SyncQueueTask['payload']
) {
  if (!localDb) throw new Error("IndexedDB not available")

  await localDb.syncQueue.add({
    operation,
    entityId: crypto.randomUUID(),
    payload,
    status: 'PENDING',
    attempts: 0,
    createdAt: new Date()
  })
}
