/**
 * Builds the "Misir asks" prompt from a real, backend-generated open gap —
 * not from hardcoded editorial questions. Returns null when there are no open
 * gaps, so the card simply doesn't render (no fabricated demo content).
 */

import type { Gap, Space, Subspace } from "@/lib/api/types"

export type MisirQuestion = {
  context: string
  question: string
  placeholder: string
  /** Generic reply shown only if the live chat stream fails. */
  fallback: string
}

const SEVERITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2 }

export const GENERIC_FALLBACK =
  "That's a start. File it and see what's still missing when you look at it next to your other captures."

/**
 * Pick the highest-severity open gap as the question Misir asks. The gap label
 * is itself a backend-generated question. Returns null (no card) when there are
 * no open gaps.
 */
export function questionFromGaps(
  space: Space | undefined,
  subspaces: Subspace[],
  gaps: Gap[],
): (MisirQuestion & { subspace: Subspace | null }) | null {
  if (!space) return null
  const open = gaps.filter((g) => g.status !== "resolved")
  if (open.length === 0) return null
  const gap = [...open].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  )[0]
  return {
    context: gap.action || `An open gap in ${space.name}.`,
    question: gap.label,
    placeholder: "Type your answer…",
    fallback: GENERIC_FALLBACK,
    subspace: subspaces[0] ?? null,
  }
}
