/**
 * Dexie database for offline-first storage
 * Ported from old extension, simplified
 */

import Dexie, { Table } from 'dexie'
import type {
  PendingArtifact,
  Space,
  Subspace,
  Marker,
  SubspaceWithMarkers,
} from '@/lib/types'

export class MisirDB extends Dexie {
  pendingArtifacts!: Table<PendingArtifact>
  spaces!: Table<Space>
  subspaces!: Table<Subspace>
  markers!: Table<Marker>

  constructor() {
    super('MisirDB')
    this.version(1).stores({
      pendingArtifacts: '++id, &contentHash, spaceId, subspaceId, contentSource, capturedAt, syncedAt, syncAttempts',
      spaces: 'id, userId, name',
      subspaces: '++id, spaceId, userId, name',
      markers: '++id, spaceId, userId, label',
    })
    // v2: index normalizedUrl (the web-capture dedup queries on it) and drop the
    // unique constraint on contentHash — dedup is handled manually in a 24h
    // window, so a strict unique index only caused ConstraintErrors on re-queue.
    this.version(2).stores({
      pendingArtifacts: '++id, contentHash, normalizedUrl, spaceId, subspaceId, contentSource, capturedAt, syncedAt, syncAttempts',
      spaces: 'id, userId, name',
      subspaces: '++id, spaceId, userId, name',
      markers: '++id, spaceId, userId, label',
    })
  }
}

export const db = new MisirDB()

// Helper to get subspaces with their markers
export async function getSubspacesWithMarkers(): Promise<SubspaceWithMarkers[]> {
  const [subspaces, markers] = await Promise.all([
    db.subspaces.toArray(),
    db.markers.toArray(),
  ])

  const markersById = new Map<number, Marker>()
  const markersBySpaceId = new Map<number, Marker[]>()
  for (const m of markers) {
    markersById.set(m.id, m)
    const list = markersBySpaceId.get(m.spaceId) ?? []
    list.push(m)
    markersBySpaceId.set(m.spaceId, list)
  }

  return subspaces.map((s) => {
    // Prefer the subspace's own markers (from subspace_marker); fall back to the
    // whole space's markers only if this subspace has none mapped.
    const own = (s.markerIds ?? [])
      .map((id) => markersById.get(id))
      .filter((m): m is Marker => !!m)
    return {
      ...s,
      markers: own.length ? own : markersBySpaceId.get(s.spaceId) ?? [],
    }
  })
}

// Clear all local data (for sign out)
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', db.pendingArtifacts, db.spaces, db.subspaces, db.markers, async () => {
    await db.pendingArtifacts.clear()
    await db.spaces.clear()
    await db.subspaces.clear()
    await db.markers.clear()
  })
}

// After this many failed sync attempts an artifact is considered "stuck": it
// stops auto-retrying (so a poison payload can't loop forever) and drops out of
// the live pending count. Such artifacts must NOT vanish silently — they're
// surfaced in the popup for the user to retry or discard. See getFailedArtifacts.
export const MAX_SYNC_ATTEMPTS = 5

// Get pending count for sync status — only artifacts still actively retrying.
export async function getPendingCount(): Promise<number> {
  return db.pendingArtifacts
    .filter((a) => !a.syncedAt && (a.syncAttempts ?? 0) < MAX_SYNC_ATTEMPTS)
    .count()
}

// "Stuck" artifacts: saved locally but never synced after exhausting retries.
// These would otherwise be silent data loss — the user saved something and it
// quietly died in IndexedDB. The popup lists them so nothing is lost without a say.
export async function getFailedArtifacts(): Promise<PendingArtifact[]> {
  return db.pendingArtifacts
    .filter((a) => !a.syncedAt && (a.syncAttempts ?? 0) >= MAX_SYNC_ATTEMPTS)
    .toArray()
}

export async function getFailedCount(): Promise<number> {
  return db.pendingArtifacts
    .filter((a) => !a.syncedAt && (a.syncAttempts ?? 0) >= MAX_SYNC_ATTEMPTS)
    .count()
}

// Reset stuck artifacts so the retry loop picks them up again (e.g. the user was
// offline, or the backend was down, and is now back). Returns how many requeued.
export async function requeueFailedArtifacts(): Promise<number> {
  const failed = await getFailedArtifacts()
  await Promise.all(
    failed.map((a) => db.pendingArtifacts.update(a.id!, { syncAttempts: 0 })),
  )
  return failed.length
}

// Permanently drop stuck artifacts the user chooses not to keep. Returns count.
export async function discardFailedArtifacts(): Promise<number> {
  const failed = await getFailedArtifacts()
  await db.pendingArtifacts.bulkDelete(failed.map((a) => a.id!))
  return failed.length
}