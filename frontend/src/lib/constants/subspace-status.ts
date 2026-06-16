/**
 * Editorial one-liner per subspace, shown under the title on the subspace
 * status list.
 *
 * Ported from `design_handoff_misir/dashboard/views.js` SS_STATUS. Matched
 * by subspace name regex. Production subspaces with unmatched names get a
 * computed fallback like "X captures · Y% complete."
 */

export type SubspaceStatusLine = {
  match: RegExp
  text: string
}

export const SUBSPACE_STATUS: SubspaceStatusLine[] = [
  { match: /investor/i, text: "Your strongest coverage. Wavemaker and Jungle Ventures both mapped." },
  { match: /cac|unit\s*econ/i, text: "The 18-month threshold appears 6 times. Not yet connected to your own financials." },
  { match: /competition/i, text: "Pitstop and Park+ covered. No comparable raises mapped to Zantrik yet." },
  { match: /gomechanic|forensic/i, text: "Opened 3 times without resolving. One focused session closes this." },
  { match: /market|tam/i, text: "Bangladesh aftermarket sized. SEA fleet operator count still missing." },
  { match: /narrative|deck/i, text: "Three angles surfaced. None tested against an investor audience yet." },
  { match: /customer\s*evidence/i, text: "Internal data pull needed. Cannot be filled by web sources." },
  { match: /customer\s*signals/i, text: "Fleet API and offline mode top the list. Reliability over features." },
  { match: /tech\s*debt/i, text: "API migration is the highest-leverage item. Unlocks 3 blocked features." },
  { match: /competitor\s*features/i, text: "Park+ and Carro both shipped offline-first in Q1. Window is closing." },
  { match: /resource|capacity/i, text: "Engineering capacity data lives in Linear. Pull it before the roadmap locks." },
  { match: /release|launch/i, text: "No sequencing plan yet. Board will ask what ships first." },
  { match: /market\s*validation/i, text: "Uncontested segment. Most operators are spreadsheet or WhatsApp-based." },
  { match: /segment/i, text: "SME vs. enterprise tension not yet resolved." },
  { match: /pricing/i, text: "No pricing model validated. You can't sign pilots without a number." },
  { match: /tech\s*infra|integration/i, text: "Integration scope undefined. Pilot customers will ask on day one." },
  { match: /sales|outreach/i, text: "No outreach plan. 45 days to kickoff with no leads yet." },
  { match: /regulatory/i, text: "BRTA requirements not yet assessed." },
  { match: /pipeline|candidate/i, text: "Two first-round-ready candidates. Pipeline ahead of schedule." },
  { match: /comp|compensation/i, text: "Offer range is competitive. Don't wait for the Series A to close." },
  { match: /interview|process/i, text: "Process designed. Leadership case study not yet scheduled." },
]

export function statusForSubspace(
  name: string,
  fallback?: { captures: number; completeness: number },
): string {
  const hit = SUBSPACE_STATUS.find((s) => s.match.test(name))
  if (hit) return hit.text
  if (fallback) {
    return `${fallback.captures} capture${fallback.captures === 1 ? "" : "s"} · ${fallback.completeness}% complete.`
  }
  return ""
}
