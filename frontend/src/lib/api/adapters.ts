/**
 * Adapters that translate raw backend payloads into the view-model shapes
 * the design expects. Keep these pure and side-effect-free.
 */

import type { DashboardPayload, Gap } from "./types"

/**
 * Overall readiness % (0–100) for a space. The backend computes a canonical
 * readiness (gap coverage + research depth + source diversity) and embeds it as
 * `synthesis.readiness` and `misirs_read.coverage` — prefer that so every
 * surface shows the same number. Only fall back to a client-side estimate for
 * reports cached before readiness existed, or empty/uncomputed dashboards.
 */
export function deriveReadiness(dash: DashboardPayload | undefined): number {
  if (!dash) return 0

  const canonical = dash.synthesis?.readiness ?? dash.misirs_read?.coverage
  if (typeof canonical === "number") {
    return Math.max(0, Math.min(100, Math.round(canonical)))
  }

  const depths = dash.research_depth ?? []
  const avgDepth =
    depths.length === 0
      ? 0
      : Math.round(
          depths.reduce((sum, d) => sum + (d.pct ?? 0), 0) / depths.length,
        )

  const critical = (dash.gaps ?? []).filter((g) => g.severity === "Critical").length
  const high = (dash.gaps ?? []).filter((g) => g.severity === "High").length
  const penalty = critical * 10 + high * 4

  return Math.max(0, Math.min(100, avgDepth - penalty))
}

export function countCriticalGaps(dash: DashboardPayload | undefined): number {
  return (dash?.gaps ?? []).filter((g) => g.severity === "Critical").length
}

/**
 * Sum captures across the activity windows. The backend already pre-filters
 * by `period` when the dashboard is fetched.
 */
export function sumCaptures(dash: DashboardPayload | undefined): number {
  return (dash?.activity ?? []).length
}

/**
 * Map a backend gap into the "severity" tone the notifications row uses.
 */
export function gapSeverityTone(g: Gap): "critical" | "warning" | "info" {
  if (g.severity === "Critical") return "critical"
  if (g.severity === "High") return "warning"
  return "info"
}
