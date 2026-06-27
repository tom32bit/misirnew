/**
 * TypeScript mirrors of the backend Pydantic response shapes.
 * Keep in sync with `backend/interfaces/api/*.py` and
 * `backend/domain/entities/common.py`.
 */

export type AuthUser = {
  id: string
  clerk_user_id: string
  email: string
}

export type Space = {
  id: number
  user_id: string
  name: string
  goal: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export type Subspace = {
  id: number
  space_id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
  /** Populated by the list endpoint via subspace_marker join. */
  marker_ids?: number[]
}

export type Marker = {
  id: number
  space_id: number
  label: string
  weight: number
  created_at: string
}

export type SubspaceMarker = {
  subspace_id: number
  marker_id: number
  weight: number
  source: string | null
  marker?: Marker
}

export type PlatformType =
  | "claude"
  | "chatgpt"
  | "gemini"
  | "perplexity"
  | "deepseek"
  | "grok"
  | "copilot"
  | "notebooklm"
  | "kimi"
  | "web"

export type EngagementLevel = "latent" | "passive" | "active" | "deep"
export type GapSeverity = "Critical" | "High" | "Medium"
export type GapStatus = "open" | "in_progress" | "resolved"
export type NudgeStatus = "active" | "dismissed" | "acted"

export type Artifact = {
  id: number
  user_id: string
  space_id: number | null
  url: string
  normalized_url: string
  domain: string | null
  title: string | null
  extracted_text: string | null
  content_hash: string | null
  word_count: number
  content_source: "web" | "ai_chat"
  platform: PlatformType
  engagement_level: EngagementLevel
  dwell_time_ms: number
  scroll_depth: number
  reading_depth: number
  base_weight: number
  matched_marker_ids: number[]
  captured_at: string
  updated_at: string
  metadata: Record<string, unknown>
  artifact_tag?: { tag: string }[]
  artifact_open_event?: { count: number }[]
}

export type Gap = {
  id: number
  space_id: number
  severity: GapSeverity
  label: string
  action: string | null
  status: GapStatus
  recurring_count: number
  first_seen_at: string
  last_seen_at: string
  resolved_at: string | null
  created_at: string
  updated_at: string
  subspace_id?: number | null
}

export type Nudge = {
  id: number
  user_id: string
  space_id: number | null
  scatter: string
  direction: string
  consequence: string | null
  cta_label: string | null
  cta_href: string | null
  priority: number
  status: NudgeStatus
  evidence_data: Record<string, unknown> | null
  requires_deadline: boolean
  generated_at: string
  dismissed_at: string | null
}

export type Deadline = {
  id: number
  user_id: string
  space_id: number
  label: string
  due_at: string
  target_pct: number
  created_at: string
  updated_at: string
}

export type Conversation = {
  id: number
  user_id: string
  space_id: number | null
  title: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: number
  conversation_id: number
  role: "user" | "misir"
  content: string
  context_hash: string | null
  token_count: number | null
  created_at: string
}

export type MisirsRead = {
  headline: string
  points: { label: string; body: string; accent: boolean }[]
  coverage: number
  gaps: number
}

export type DashboardSource = {
  key: string
  label: string
  artifacts: number
  color: string
  topInsight: string
  themes: { text: string; conf: number }[]
  signal: string
}

export type DashboardSynthesis = {
  consensus: string
  conflict: string
  blindspot: string
  readiness: number
}

export type KeyTension = {
  points: { label: string; text: string; num: string }[]
  edge: string
  meta: string
}

export type DashboardDecision = {
  // question/note/ask are optional: reports cached before these were generated
  // (or any future model that omits them) fall back to editorial constants.
  question?: string
  option_a: { label: string; note?: string; pros: string[]; cons: string[] }
  option_b: { label: string; note?: string; pros: string[]; cons: string[] }
  ask?: string
}

export type ResearchDepth = {
  label: string
  pct: number
  warn: boolean
}

export type ActivityItem = {
  time: string
  source: string
  title: string
  tags: string[]
  revisit: boolean
  crossLink: boolean
}

export type CrossSpaceLink = {
  source_title: string
  target_gap: string
  similarity: number
}

/** Real per-subspace capture stats, attributed via shared markers on the backend. */
export type DashboardSubspaceStat = {
  id: number
  name: string
  captures: number
  completeness: number
  last_captured_at: string | null
}

export type DashboardPayload = {
  misirs_read: MisirsRead | null
  subspaces: DashboardSubspaceStat[]
  sources: DashboardSource[]
  synthesis: DashboardSynthesis | null
  key_tension: KeyTension | null
  decision: DashboardDecision | null
  research_depth: ResearchDepth[]
  activity: ActivityItem[]
  cross_space: CrossSpaceLink[]
  gaps: Gap[]
  nudges: Nudge[]
  deadline: Deadline | null
}

export type ReportPeriod = "today" | "week" | "month"

/** Returned by POST /spaces/generate — augmented Space with seeded children. */
export type SpaceGenerated = Space & {
  subspaces: (Subspace & {
    markers: { label: string; weight: number }[]
  })[]
  ai_generated: boolean
}
