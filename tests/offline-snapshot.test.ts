import { describe, expect, it } from "vitest"
import { isCollectorSnapshotUsable, isSnapshotUsable } from "@/lib/offline-snapshot"
import type { CollectorSnapshot } from "@/lib/localdb"

const now = new Date("2026-10-13T10:00:00.000Z").getTime()
const snapshot: CollectorSnapshot = {
  id: "user-a:collector", userId: "user-a", module: "collector", downloadedAt: new Date(now),
  expiresAt: new Date(now + 3600000), data: { products: [], inventories: [] }
}

describe("prepared collector access", () => {
  it("requires the same authenticated user", () => {
    expect(isCollectorSnapshotUsable(snapshot, "user-a", new Date(now + 7200000).toISOString(), now)).toBe(true)
    expect(isCollectorSnapshotUsable(snapshot, "user-b", new Date(now + 7200000).toISOString(), now)).toBe(false)
  })

  it("expires when either the snapshot or the session expires", () => {
    expect(isCollectorSnapshotUsable(snapshot, "user-a", new Date(now + 7200000).toISOString(), now + 3600000)).toBe(false)
    expect(isCollectorSnapshotUsable(snapshot, "user-a", new Date(now + 60000).toISOString(), now + 60000)).toBe(false)
    expect(isCollectorSnapshotUsable(snapshot, "user-a", "invalid", now)).toBe(false)
  })
})

describe("generic module snapshots", () => {
  it("applies the same ownership and expiry rules to any module", () => {
    const other = { userId: "user-a", expiresAt: new Date(now + 3600000) }
    expect(isSnapshotUsable(other, "user-a", new Date(now + 7200000).toISOString(), now)).toBe(true)
    expect(isSnapshotUsable(other, "user-b", new Date(now + 7200000).toISOString(), now)).toBe(false)
    expect(isSnapshotUsable(undefined, "user-a", new Date(now + 7200000).toISOString(), now)).toBe(false)
  })
})
