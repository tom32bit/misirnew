/**
 * "What Misir noticed" — 5 cross-space insight rows shown under the hero on
 * the all-spaces home. Each insight type has its own color used for the type
 * chip, hover background, and CTA border.
 *
 * Ported from `design_handoff_misir/dashboard/views.js` (INSIGHTS + TYPE_META).
 * The space chips are matched dynamically by name regex — if the user
 * doesn't have a space that matches an insight, the chip is hidden but the
 * insight row still renders.
 */

import type { Space } from "@/lib/api/types"

export type InsightType =
  | "cross-space"
  | "pattern"
  | "collision"
  | "readiness"
  | "blindspot"

export type InsightTypeMeta = {
  color: string
  bg: string
  icon: string
  label: string
}

export const TYPE_META: Record<InsightType, InsightTypeMeta> = {
  "cross-space": {
    color: "#2A4A7A",
    bg: "rgba(42,74,122,0.07)",
    icon: "link-2",
    label: "Cross-space",
  },
  pattern: {
    color: "#FF6C3C",
    bg: "rgba(255,108,60,0.07)",
    icon: "repeat",
    label: "Pattern",
  },
  collision: {
    color: "#B8730D",
    bg: "rgba(184,115,13,0.07)",
    icon: "alert-circle",
    label: "Deadline",
  },
  readiness: {
    color: "#2A6A4A",
    bg: "rgba(42,106,74,0.07)",
    icon: "check-circle",
    label: "Almost there",
  },
  blindspot: {
    color: "#A8423D",
    bg: "rgba(168,66,61,0.07)",
    icon: "eye-off",
    label: "Blind spot",
  },
}

export type Insight = {
  type: InsightType
  text: string
  cta: string
  /** Relative URL. `:id` is replaced with the first matched space's id. */
  href: string
  /** Regexes against `space.name`; matched spaces become chips on the row. */
  spaceMatchers: RegExp[]
}

export const INSIGHTS: Insight[] = [
  {
    type: "readiness",
    text:
      "You are 2 reference calls away from making the VP Engineering offer. Everything else in the hire space is done. Readiness shows 71% but the real gap is a single afternoon.",
    cta: "Open Hire",
    href: "/dashboard/:id/home",
    spaceMatchers: [/hire|vp/i],
  },
  {
    type: "collision",
    text:
      "VP Engineering offer in 14 days. H2 roadmap board review in 18 days. The person you hire changes what can realistically ship in H2. You haven't connected these two decisions.",
    cta: "See both",
    href: "/dashboard/all/decision",
    spaceMatchers: [/hire|vp/i, /roadmap|h2/i],
  },
  {
    type: "pattern",
    text:
      "You've opened GoMechanic 3 times and Fleet SaaS pricing twice this week — neither has moved. These aren't knowledge gaps. You're circling the hardest questions.",
    cta: "Break the loop",
    href: "/dashboard/:id/decision",
    spaceMatchers: [/series\s*a|raise/i, /fleet/i],
  },
  {
    type: "cross-space",
    text:
      "Accelerating Asia appears in your Series A investor work <em>and</em> has an active fleet thesis. One conversation advances two spaces at once.",
    cta: "Connect spaces",
    href: "/dashboard/:id/comparison",
    spaceMatchers: [/series\s*a|raise/i, /fleet/i],
  },
  {
    type: "blindspot",
    text:
      "Captures keep landing. Readiness moved in 2 of 4 spaces. The reading is happening — the synthesis isn't. None of your Fleet SaaS captures have generated a decision yet.",
    cta: "Open Collection",
    href: "/dashboard/all/collection",
    spaceMatchers: [/fleet/i, /roadmap|h2/i],
  },
]

/**
 * Materialise the chip-space mapping. Each matcher resolves against the
 * user's actual spaces — unmatched matchers are dropped.
 */
export function resolveInsightSpaces(
  insight: Insight,
  spaces: Space[],
): { chips: Space[]; firstId: number | null } {
  const chips: Space[] = []
  for (const re of insight.spaceMatchers) {
    const found = spaces.find((s) => re.test(s.name))
    if (found && !chips.some((c) => c.id === found.id)) chips.push(found)
  }
  return { chips, firstId: chips[0]?.id ?? null }
}
