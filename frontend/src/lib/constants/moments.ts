/**
 * "Moments" — three-line editorial blocks rendered in the all-spaces hero.
 * The third line is rendered in `accent` color.
 *
 * Ported verbatim from `design_handoff_misir/dashboard/views.js`. Editorial
 * copy is treated as final UI — do not paraphrase. The prototype rotates
 * one of these per visit; v1 picks by day-of-month for determinism.
 *
 * `spaceMatcher` is a regex (case-insensitive) tested against a space's
 * `name`. A moment only "applies" when at least one of the user's spaces
 * matches; otherwise we fall back to GENERIC_MOMENT.
 */

import type { Space } from "@/lib/api/types"

export type Moment = {
  text: string
  accent: string
  spaceMatcher: RegExp
  /** Where the CTA button takes the user. `:id` is replaced with the matched space id. */
  href: string
  cta: string
}

export const MOMENTS: Moment[] = [
  {
    text:
      "You've opened GoMechanic three times\nthis week. You haven't written\na single answer down.",
    accent: "#FF6C3C",
    spaceMatcher: /series\s*a|raise/i,
    href: "/dashboard/:id/decision",
    cta: "Break the loop",
  },
  {
    text:
      "The person you hire as VP Engineering\ndirectly changes what ships\nin H2. You haven't connected these.",
    accent: "#B8730D",
    spaceMatcher: /hire|vp/i,
    href: "/dashboard/all/decision",
    cta: "See the collision",
  },
  {
    text:
      "Two reference calls. That's all\nthat stands between you and\nthe VP Engineering offer.",
    accent: "#2A6A4A",
    spaceMatcher: /hire|vp/i,
    href: "/dashboard/:id/home",
    cta: "Open Hire",
  },
  {
    text:
      "One conversation with Accelerating Asia\nadvances both your Series A\nand Fleet SaaS spaces at once.",
    accent: "#2A4A7A",
    spaceMatcher: /series\s*a|raise/i,
    href: "/dashboard/:id/comparison",
    cta: "Connect spaces",
  },
]

export const GENERIC_MOMENT: Omit<Moment, "spaceMatcher"> = {
  text:
    "You've been capturing.\nThe synthesis is harder than the reading.\nPick the one decision that matters most.",
  accent: "#FF6C3C",
  href: "/dashboard/all/decision",
  cta: "Open decision tree",
}

/**
 * Pick a moment that matches one of the user's spaces. Selection is
 * day-of-month-based so the same moment shows for the user all day
 * (avoids a flicker on every page load).
 */
export function pickMoment(spaces: Space[]): {
  text: string
  accent: string
  href: string
  cta: string
  spaceId: number | null
} {
  const candidates = MOMENTS.map((m) => {
    const space = spaces.find((s) => m.spaceMatcher.test(s.name))
    return space ? { m, space } : null
  }).filter(Boolean) as { m: Moment; space: Space }[]

  if (candidates.length === 0) {
    return { ...GENERIC_MOMENT, spaceId: null }
  }

  const idx = new Date().getDate() % candidates.length
  const { m, space } = candidates[idx]
  return {
    text: m.text,
    accent: m.accent,
    href: m.href.replace(":id", String(space.id)),
    cta: m.cta,
    spaceId: space.id,
  }
}
