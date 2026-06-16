/**
 * Per-space color resolution.
 *
 * The design assigns one accent color per space, used for dots, rings, bars,
 * and tags. Production spaces are user-created with integer IDs, so we can't
 * lift the prototype's name → color map verbatim. Strategy:
 *
 *   1. If a user-set color override exists in the space `metadata.color` or
 *      `profile.settings.space_colors[id]`, use it (TODO: backend support).
 *   2. If the space name matches one of the seeded prototype names, use the
 *      original color (preserves design demos when seeding from data.js).
 *   3. Otherwise pick a deterministic color from PALETTE by hashing the id.
 */

const PALETTE = [
  "#FF6C3C", // accent orange
  "#2A6A4A", // moss green
  "#2A4A7A", // navy blue
  "#7A3FA0", // plum purple
  "#B8730D", // amber
  "#A8423D", // brick red
  "#4A6A3A", // olive
  "#6E6862", // warm gray
] as const

const SEEDED: Record<string, string> = {
  "series a": "#FF6C3C",
  "raise series a": "#FF6C3C",
  "product roadmap h2": "#2A6A4A",
  roadmap: "#2A6A4A",
  "fleet saas expansion": "#2A4A7A",
  fleet: "#2A4A7A",
  "hire vp engineering": "#7A3FA0",
  hire: "#7A3FA0",
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function getSpaceColor(
  space: { id: number | string; name?: string | null } | null | undefined,
): string {
  if (!space) return PALETTE[0]
  const key = (space.name ?? "").trim().toLowerCase()
  if (key && SEEDED[key]) return SEEDED[key]
  return PALETTE[hash(String(space.id)) % PALETTE.length]
}
