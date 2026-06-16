/**
 * Per-space editorial brief — the 20px Inter Tight 500 paragraph shown
 * under "Misir's read" on the single-space Home.
 *
 * Ported verbatim from `design_handoff_misir/dashboard/views.js` SPACE_BRIEFS.
 * Keyed by name regex so the demo copy lights up when users seed the
 * canonical demo spaces. Otherwise we fall back to a generic computed brief.
 */

import type { Space } from "@/lib/api/types"

export type SpaceBrief = {
  match: RegExp
  text: string
}

export const SPACE_BRIEFS: SpaceBrief[] = [
  {
    match: /series\s*a|raise/i,
    text:
      "Six days to Wavemaker. 46 captures across 7 subspaces — you've been thorough. But you've opened GoMechanic three times this week without answering it. That's the one gap that matters. Wavemaker will ask it in the first ten minutes.",
  },
  {
    match: /roadmap|h2/i,
    text:
      "Board review in 18 days. You have the customer signals — fleet API and offline mode top the list. You don't have the release sequence. That's what the board will ask first. Not what you're building. In what order.",
  },
  {
    match: /fleet/i,
    text:
      "Pilot kickoff in 45 days. Three subspaces below 20% — pricing, tech integration, sales motion. None of these close with more reading. Book three fleet manager calls this week.",
  },
  {
    match: /hire|vp/i,
    text:
      "Two reference calls. That's the only thing between you and an offer to Arif Hasan. 71% readiness and the missing 29% is one afternoon of phone calls. The offer deadline is in 14 days.",
  },
]

/** Returns a brief for the given space, or a generic fallback. */
export function briefForSpace(
  space: Space | undefined,
  fallback?: { capturesWeek: number; subspaceCount: number },
): string {
  if (space) {
    const hit = SPACE_BRIEFS.find((b) => b.match.test(space.name))
    if (hit) return hit.text
  }
  if (fallback) {
    const { capturesWeek, subspaceCount } = fallback
    return `${capturesWeek} captures this week across ${subspaceCount} subspaces. Click into the ones with the lowest completeness — that's where the next decision lives.`
  }
  return "Misir is reading your captures. The brief lands once you've made a few."
}
