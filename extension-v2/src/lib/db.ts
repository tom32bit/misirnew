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

// Get pending count for sync status
export async function getPendingCount(): Promise<number> {
  return db.pendingArtifacts
    .filter((a) => !a.syncedAt && (a.syncAttempts ?? 0) < 5)
    .count()
}