/**
 * Capture / subspace adapters that compose backend payloads into the
 * design's expected view-model shapes. Pure functions only — no fetches.
 */

import type {
  Artifact,
  DashboardPayload,
  DashboardSubspaceStat,
  Subspace,
} from "./types"

import {
  captureType,
  surfaceIcon,
  surfaceLabel,
} from "@/lib/constants/surface-icons"

/** Best-match subspace for an artifact based on matched_marker_ids overlap. */
function resolveSubspaceId(
  matchedMarkerIds: number[] | null | undefined,
  subspaces: Subspace[],
): number | null {
  if (!matchedMarkerIds || matchedMarkerIds.length === 0) return null
  const aSet = new Set(matchedMarkerIds)
  let bestId: number | null = null
  let bestScore = 0
  for (const s of subspaces) {
    if (!s.marker_ids || s.marker_ids.length === 0) continue
    const overlap = s.marker_ids.filter((m) => aSet.has(m)).length
    const score = overlap / s.marker_ids.length
    if (score > bestScore) {
      bestScore = score
      bestId = s.id
    }
  }
  // Require at least 30% overlap to count (keeps unrelated subspaces out).
  return bestScore >= 0.3 ? bestId : null
}

export type CaptureVM = {
  id: string
  capturedAt: string
  /** "HH:MM" */
  time: string
  /** "Today" | "Yesterday" | "2d ago" | "Aug 14" */
  date: string
  surface: string
  surfaceIcon: string
  type: "Article" | "AI chat" | "PDF" | "Video" | "Post"
  title: string
  marker: string
  /** From artifact.space_id (null when unassigned). */
  spaceId: number | null
  /** From artifact.subspace_id (the extension's on-device match), or null. */
  subspaceId: number | null
  /** revisit_count from artifact_open_event[0].count (minus the original open). */
  revisit?: number
}

export function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

function timeLabel(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function dayBucket(d: Date, now = new Date()): string {
  const startOf = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const daysAgo = Math.round((startOf(now) - startOf(d)) / (24 * 60 * 60 * 1000))
  if (daysAgo <= 0) return "Today"
  if (daysAgo === 1) return "Yesterday"
  if (daysAgo < 7) return `${daysAgo}d ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/** Best-effort marker label for a capture row. */
function markerLabel(a: Artifact): string {
  const meta = (a.metadata ?? {}) as Record<string, unknown>
  if (typeof meta.marker_label === "string") return meta.marker_label
  if (Array.isArray(meta.matched_markers) && meta.matched_markers.length > 0) {
    const first = meta.matched_markers[0]
    if (typeof first === "string") return first
    if (first && typeof first === "object" && "label" in first) {
      const lbl = (first as { label?: unknown }).label
      if (typeof lbl === "string") return lbl
    }
  }
  // Fallback: first tag, or empty
  return a.artifact_tag?.[0]?.tag ?? ""
}

export function adaptCapture(
  a: Artifact,
  now = new Date(),
  subspaces: Subspace[] = [],
): CaptureVM {
  const captured = new Date(a.captured_at)
  // Prefer the real subspace_id the extension matched on-device; fall back to
  // legacy metadata, then a marker-overlap best-match for pre-subspace_id rows.
  const metaSubspace =
    typeof (a.metadata as Record<string, unknown> | null)?.subspace_id === "number"
      ? ((a.metadata as Record<string, unknown>).subspace_id as number)
      : null
  const subspaceId =
    a.subspace_id ?? metaSubspace ?? resolveSubspaceId(a.matched_marker_ids, subspaces)
  const revisitCount = a.artifact_open_event?.[0]?.count ?? 0
  const revisit = revisitCount > 1 ? revisitCount - 1 : undefined

  return {
    id: String(a.id),
    capturedAt: a.captured_at,
    time: timeLabel(captured),
    date: dayBucket(captured, now),
    surface: surfaceLabel(a),
    surfaceIcon: surfaceIcon(a),
    type: captureType(a),
    title: a.title ?? a.url,
    marker: markerLabel(a),
    spaceId: a.space_id,
    subspaceId,
    revisit,
  }
}

export function adaptCaptures(
  artifacts: Artifact[],
  now = new Date(),
  subspaces: Subspace[] = [],
): CaptureVM[] {
  return artifacts.map((a) => adaptCapture(a, now, subspaces))
}

export type SubspaceVM = {
  id: number
  name: string
  description: string | null
  captures: number
  /** Captures in the last 7d minus the prior 7d. */
  weekDelta: number
  /** 0–100, prefers backend's research_depth then falls back to capture count. */
  completeness: number
  /** Relative "32m ago" / "1h ago" / "Yesterday" string. */
  lastHit: string
  flag?: "critical" | "low"
  flagNote?: string
}

function relTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "—"
  const diff = Math.max(0, now - t)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return "Yesterday"
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  return `${w}w ago`
}

export function adaptSubspaces(
  subs: Subspace[],
  artifacts: Artifact[],
  depth?: DashboardPayload["research_depth"],
  stats?: DashboardSubspaceStat[],
  now = new Date(),
  period: "today" | "week" | "month" | "all" = "week",
): SubspaceVM[] {
  const nowMs = now.getTime()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const statById = new Map<number, DashboardSubspaceStat>()
  for (const st of stats ?? []) statById.set(st.id, st)

  return subs.map((s) => {
    // Prefer the backend stat (it joins artifact markers to each subspace's
    // markers). Fall back to local attribution via the artifact's real
    // subspace_id when no stat is present.
    const stat = statById.get(s.id)

    const owned = artifacts.filter((a) => {
      if (a.subspace_id != null) return a.subspace_id === s.id
      const meta = (a.metadata ?? {}) as Record<string, unknown>
      return typeof meta.subspace_id === "number" && meta.subspace_id === s.id
    })

    const capturedAts = owned
      .map((a) => Date.parse(a.captured_at))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)

    const last7 = owned.filter((a) => nowMs - Date.parse(a.captured_at) <= weekMs).length
    // prior7 is only meaningful when the artifact window covers at least 14d
    // (month view). On week/today views, the array stops at 7d so prior7 is
    // always 0, making the delta misleadingly positive.
    const prior7 =
      period === "month"
        ? owned.filter((a) => {
            const t = Date.parse(a.captured_at)
            return nowMs - t > weekMs && nowMs - t <= 2 * weekMs
          }).length
        : 0

    const captures = stat?.captures ?? owned.length
    const completeness = Math.max(
      0,
      Math.min(100, stat?.completeness ?? owned.length * 10),
    )

    const flag: SubspaceVM["flag"] =
      completeness < 25
        ? "critical"
        : completeness < 40 && last7 === 0
          ? "low"
          : undefined

    const lastHit = stat?.last_captured_at
      ? relTime(stat.last_captured_at, nowMs)
      : capturedAts.length > 0
        ? relTime(new Date(capturedAts[0]).toISOString(), nowMs)
        : "—"

    return {
      id: s.id,
      name: s.name,
      description: s.description,
      captures,
      weekDelta: last7 - prior7,
      completeness,
      lastHit,
      flag,
      flagNote:
        flag === "critical"
          ? "Opened repeatedly without resolving."
          : flag === "low"
            ? "Needs an internal data pull."
            : undefined,
    }
  })
}
