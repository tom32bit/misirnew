/**
 * Per-subspace color. Prototype hardcodes a curated palette per known
 * subspace; production subspaces have arbitrary user-generated names, so we
 * (1) try to match a curated label, then (2) fall back to a deterministic
 * hash-derived palette.
 */

const PALETTE = [
  "#FF6C3C",
  "#2A6A4A",
  "#2A4A7A",
  "#7A3FA0",
  "#B8730D",
  "#A8423D",
  "#4A6A3A",
  "#5A3F80",
  "#9A4FA0",
  "#6E6862",
] as const

const SEEDED: { match: RegExp; color: string }[] = [
  { match: /investor/i, color: "#FF6C3C" },
  { match: /cac|unit\s*econ/i, color: "#2A6A4A" },
  { match: /competition|competit/i, color: "#2A4A7A" },
  { match: /gomechanic|forensic/i, color: "#B8730D" },
  { match: /market|tam/i, color: "#6E6862" },
  { match: /narrative|deck/i, color: "#7A3FA0" },
  { match: /customer\s*evidence|retention/i, color: "#A8423D" },
  { match: /tech\s*debt|api/i, color: "#4A6A3A" },
  { match: /release|launch/i, color: "#FF6C3C" },
  { match: /resource|capacity|hiring/i, color: "#6E6862" },
  { match: /pricing|price/i, color: "#B8730D" },
  { match: /sales|outreach/i, color: "#A8423D" },
  { match: /regulatory|compliance/i, color: "#6E6862" },
  { match: /pipeline|candidate/i, color: "#7A3FA0" },
  { match: /comp|compensation|salary/i, color: "#5A3F80" },
  { match: /interview|process/i, color: "#9A4FA0" },
  { match: /segment|market\s*validation/i, color: "#2A4A7A" },
  { match: /integration|infra|tech/i, color: "#2A6A4A" },
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function getSubspaceColor(
  subspace: { id: number | string; name?: string | null } | null | undefined,
): string {
  if (!subspace) return PALETTE[0]
  const name = (subspace.name ?? "").trim()
  const seeded = SEEDED.find((s) => s.match.test(name))
  if (seeded) return seeded.color
  return PALETTE[hash(name || String(subspace.id)) % PALETTE.length]
}
