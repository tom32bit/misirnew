/**
 * Shared TypeScript types for the extension
 */

// Platform types matching backend
export type PlatformType =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'perplexity'
  | 'deepseek'
  | 'grok'
  | 'copilot'
  | 'notebooklm'
  | 'kimi'
  | 'web'

export type EngagementLevel = 'latent' | 'passive' | 'active' | 'deep'

export type ContentSource = 'web' | 'ai_chat'

// Space & Subspace (from backend cache)
export interface Space {
  id: number
  userId: string
  name: string
  description?: string
  goal?: string
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
  /** Marker ids that belong specifically to this subspace (from subspace_marker). */
  markerIds?: number[]
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

export interface SubspaceWithMarkers extends Subspace {
  markers: Marker[]
}

// Capture types
export interface PageContent {
  title: string
  textContent: string
  excerpt: string | null
  wordCount: number
  url: string
  normalizedUrl: string
  domain: string
  contentHash: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt?: Date
}

export interface ChatCapture {
  platform: PlatformType
  conversationId: string
  title: string
  url: string
  messages: ChatMessage[]
  capturedAt: Date
}

// Messages between content script and background
export interface CapturePageMessage {
  type: 'CAPTURE_PAGE'
  url: string
  normalizedUrl: string
  domain: string
  title?: string
  textContent: string
  contentHash: string
  wordCount: number
}

export interface CaptureAIChatMessage {
  type: 'CAPTURE_AI_CHAT'
  capture: ChatCapture
  normalizedUrl: string
  domain: string
  contentHash: string
  wordCount: number
}

export interface UpdateEngagementMessage {
  type: 'UPDATE_ENGAGEMENT'
  remoteId: number
  dwellTimeMs: number
  scrollDepth: number
  readingDepth: number
  engagementLevel: EngagementLevel
}

// Local, non-saving match preview — runs the matcher against cached spaces and
// returns the best space/score without uploading or persisting anything.
export interface PreviewMatchMessage {
  type: 'PREVIEW_MATCH'
  text: string
}

export interface CaptureResultMessage {
  matched: boolean
  remoteId?: number
  subspaceId?: number
  spaceName?: string
  subspaceName?: string
  confidence?: number
}

// Pending artifact (local queue)
export interface PendingArtifact {
  id?: number
  userId: string
  spaceId: number
  subspaceId: number
  title: string
  url: string
  normalizedUrl: string
  domain: string
  extractedText: string
  contentHash: string
  wordCount: number
  contentSource: ContentSource
  platform?: PlatformType
  engagementLevel: EngagementLevel
  dwellTimeMs: number
  scrollDepth: number
  readingDepth: number
  baseWeight: number
  decayRate: 'high' | 'medium' | 'low'
  relevance: number
  matchedMarkerIds: number[]
  metadata?: Record<string, unknown>
  capturedAt: Date
  syncedAt?: Date
  remoteId?: number
  syncAttempts: number
}

// API types (matching backend)
export interface ArtifactPayload {
  url: string
  normalized_url: string
  domain?: string
  title?: string
  extracted_text?: string
  content_hash?: string
  word_count: number
  content_source: ContentSource
  platform: PlatformType
  engagement_level: EngagementLevel
  dwell_time_ms: number
  scroll_depth: number
  reading_depth: number
  space_id?: number
  matched_marker_ids: number[]
  tags: string[]
  metadata: Record<string, unknown>
  captured_at: string
}

// Backend cache response
export interface CacheResponse {
  spaces: Space[]
  subspaces: Subspace[]
  markers: Marker[]
  subspace_markers?: Array<{ subspace_id: number; marker_id: number }>
}

// Backend consent response
export interface ConsentResponse {
  policy_version: string
  data_region: string
  consents: Array<{
    purpose: string
    granted: boolean
    jurisdiction: string | null
    policy_version: string
    source: string
    gpc: boolean
    updated_at: string
  }>
}

// Error types
export class ConsentRequiredError extends Error {
  constructor(
    public purpose: string,
    message = `Consent required for ${purpose}`,
  ) {
    super(message)
    this.name = 'ConsentRequiredError'
  }
}

// Extractor types
export interface ConversationExtractor {
  platform: PlatformType
  matches(url: string): boolean
  getConversationId(url: string): string | null
  extractFromDOM(): ChatMessage[]
  getTitle(messages: ChatMessage[]): string
  buildConversationData(
    messages: ChatMessage[],
    conversationId: string,
    url: string,
  ): ConversationData
}

// Structurally identical to ChatCapture so an extractor result can be sent
// directly as a CaptureAIChatMessage.capture payload.
export interface ConversationData {
  messages: ChatMessage[]
  title: string
  conversationId: string
  platform: PlatformType
  url: string
  capturedAt: Date
}