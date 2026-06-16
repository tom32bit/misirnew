// ── Enums (mirror Supabase USER-DEFINED types) ─────────────────────────────

export type ContentSource = 'web' | 'ai_chat'
export type EngagementLevel = 'latent' | 'passive' | 'active' | 'deep'
export type DecayRate = 'high' | 'medium' | 'low'

// ── Domain types ───────────────────────────────────────────────────────────

export interface Space {
  id: number
  userId: string
  name: string
  description: string
  goal: string
  evidence: number
  createdAt: Date
  updatedAt: Date
}

export interface Subspace {
  id: number
  spaceId: number
  userId: string
  name: string
  description?: string
  artifactCount: number
  confidence: number
  createdAt: Date
  updatedAt: Date
}

export interface Marker {
  id: number
  spaceId: number
  userId: string
  label: string
  weight: number
  createdAt: Date
}

export interface SubspaceMarker {
  id: number
  subspaceId: number
  markerId: number
  weight: number
  source: 'user_defined' | 'extracted' | 'suggested'
}

// Subspace enriched with its markers — used for local matching only
export interface SubspaceWithMarkers extends Subspace {
  markers: Marker[]
}

// ── Artifact (maps to misir.artifact) ─────────────────────────────────────

export interface Artifact {
  id?: number                       // Dexie local auto-increment
  remoteId?: number                 // Supabase artifact.id after sync
  userId: string
  spaceId: number
  subspaceId: number
  sessionId?: number
  title: string
  url: string
  normalizedUrl: string
  domain: string
  extractedText: string
  contentHash: string
  wordCount: number
  contentSource: ContentSource
  engagementLevel: EngagementLevel
  dwellTimeMs: number
  scrollDepth: number
  readingDepth: number
  baseWeight: 0.2 | 1.0 | 2.0
  decayRate: DecayRate
  relevance: number
  matchedMarkerIds: number[]
  capturedAt: Date
  syncedAt?: Date
  metadata?: Record<string, unknown>
  syncAttempts: number
}

// ── Messages ───────────────────────────────────────────────────────────────

export interface CapturePageMessage {
  type: 'CAPTURE_PAGE'
  url: string
  title: string
  textContent: string
  wordCount: number
  normalizedUrl: string
  domain: string
  contentHash: string
}

export interface CaptureResultMessage {
  matched: boolean
  remoteId?: number   // Supabase artifact.id — returned so content script can send engagement updates
  subspaceId?: number
  spaceName?: string
  subspaceName?: string
  confidence?: number
}

export interface UpdateEngagementMessage {
  type: 'UPDATE_ENGAGEMENT'
  remoteId: number
  dwellTimeMs: number
  scrollDepth: number
  readingDepth: number
  engagementLevel: EngagementLevel
  baseWeight: 0.2 | 1.0 | 2.0
}

export type ExtensionMessage = CapturePageMessage | UpdateEngagementMessage
