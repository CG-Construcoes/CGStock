import { localDb, type OfflineSnapshot } from "@/lib/localdb"

export async function getOfflineSnapshot<T>(module: string, userId: string): Promise<OfflineSnapshot<T> | undefined> {
  if (!localDb) return undefined
  return (await localDb.snapshots.get(`${userId}:${module}`)) as OfflineSnapshot<T> | undefined
}

export async function saveOfflineSnapshot<T>(module: string, userId: string, data: T, expiresAt: Date): Promise<OfflineSnapshot<T>> {
  if (!localDb) throw new Error("Armazenamento local indisponível neste navegador.")
  const snapshot: OfflineSnapshot<T> = {
    id: `${userId}:${module}`,
    userId,
    module,
    downloadedAt: new Date(),
    expiresAt,
    data
  }
  await localDb.snapshots.put(snapshot)
  return snapshot
}

export async function clearOfflineSnapshots(userId: string) {
  if (localDb) await localDb.snapshots.where('userId').equals(userId).delete()
}

export function isSnapshotUsable(snapshot: { userId: string; expiresAt: Date } | undefined, userId: string, sessionExpiresAt: string, now = Date.now()) {
  return !!snapshot && snapshot.userId === userId &&
    Number.isFinite(new Date(sessionExpiresAt).getTime()) &&
    now < Math.min(new Date(snapshot.expiresAt).getTime(), new Date(sessionExpiresAt).getTime())
}

export const isCollectorSnapshotUsable = isSnapshotUsable
