import Dexie, { type EntityTable } from 'dexie'
import type { Space, Subspace, Marker, SubspaceMarker, Artifact } from '@/types'

class MisirDB extends Dexie {
  // Synced caches from Supabase — used for local Stage 1+2 matching
  spaces!: EntityTable<Space, 'id'>
  subspaces!: EntityTable<Subspace, 'id'>
  markers!: EntityTable<Marker, 'id'>
  subspaceMarkers!: EntityTable<SubspaceMarker, 'id'>

  // Local queue for artifacts not yet synced to Supabase
  pendingArtifacts!: EntityTable<Artifact, 'id'>

  constructor() {
    super('misir')
    this.version(1).stores({
      spaces: 'id, userId',
      subspaces: 'id, spaceId, userId',
      markers: 'id, spaceId, userId',
      subspaceMarkers: 'id, subspaceId, markerId',
      pendingArtifacts: '++id, remoteId, normalizedUrl, spaceId, subspaceId, capturedAt, syncedAt',
    })
  }
}

export const db = new MisirDB()
