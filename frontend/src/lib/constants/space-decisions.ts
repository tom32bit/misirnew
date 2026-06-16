/**
 * Per-space "Decision" editorial constants.
 *
 * Ported from `design_handoff_misir/dashboard/data.js` SPACE_DATA[id].decision.
 * The prototype hardcoded these per known space; in production we match by
 * name regex so the demo lights up when seeded names land and otherwise
 * falls back to a generic decision frame.
 */

import type { Space } from "@/lib/api/types"

export type DecisionOption = { label: string; note: string }

export type SpaceDecision = {
  match: RegExp
  question: string
  optionA: DecisionOption
  optionB: DecisionOption
  for: string[]
  against: string[]
  ask: string
}

export const SPACE_DECISIONS: SpaceDecision[] = [
  {
    match: /series\s*a|raise/i,
    question: "Should I raise Series A now, or extend runway?",
    optionA: { label: "Raise Series A now", note: "Critical gaps remain" },
    optionB: { label: "Extend runway 6 months", note: "Not yet covered" },
    for: [
      "Accelerating Asia actively investing in automotive — thesis confirmed.",
      "B2B fleet contracts significantly de-risk the revenue narrative.",
      "No competitor has raised in 12 months — clear market window.",
      "6–9 month timeline means starting now = closing Q3.",
    ],
    against: [
      "CAC payback not confirmed below the 18-month threshold.",
      "GoMechanic question unresolved — high-probability curveball.",
      "Unit economics not benchmarked against internal Zantrik data.",
      "International lead required — local tickets cap at $500K–$1M.",
    ],
    ask: "Want to walk me through how you'd answer the GoMechanic question right now?",
  },
  {
    match: /roadmap|h2/i,
    question: "Which 3 bets should anchor the H2 roadmap?",
    optionA: {
      label: "Fleet API + Offline mode + Retention tooling",
      note: "Leading customer signal",
    },
    optionB: {
      label: "Tech debt + API migration + Fleet API",
      note: "Engineering-first — not yet modelled",
    },
    for: [
      "Fleet API requested by 8 of top 15 accounts.",
      "Offline mode cited in 34% of churn conversations.",
      "Carro and Park+ both shipped offline-first in Q1.",
      "Retention tooling directly ties to NPS improvement plan.",
    ],
    against: [
      "Engineering velocity at 60% without clearing API migration.",
      "Resource planning at 20% — capacity unknown.",
      "No release sequencing plan — board review in 18 days.",
      "No data on which features prevent churn in top accounts.",
    ],
    ask: "Want me to draft the 3-bet framework for the board based on what you've captured so far?",
  },
  {
    match: /fleet/i,
    question: "Should we launch fleet SaaS with SME or enterprise first?",
    optionA: { label: "SME-first (5–20 vehicles)", note: "3 critical gaps remain" },
    optionB: { label: "Enterprise-first (100+)", note: "Not yet covered" },
    for: [
      "SME decisions made by fleet managers — no lengthy procurement.",
      "Bangladesh market is mostly SME — largest addressable segment.",
      "Short sales cycle (4–8 weeks) fits pilot timeline.",
      "Existing Zantrik relationships are with SME fleet operators.",
    ],
    against: [
      "Pricing model not validated — no number confirmed.",
      "Tech integration scope (GPS, OBD) not scoped.",
      "No sales motion or outreach plan for pilot recruitment.",
      "No BRTA / regulatory assessment completed.",
    ],
    ask: "Want me to draft a 3-question validation script for SME fleet operator conversations?",
  },
  {
    match: /hire|vp/i,
    question: "Should we make an offer to the lead candidate, run two in parallel, or wait?",
    optionA: { label: "Make offer to lead candidate", note: "Scale & infra depth" },
    optionB: { label: "Run two candidates in parallel", note: "Slows timeline by 2 weeks" },
    for: [
      "Pipeline strongest of any space — source coverage 82%.",
      "Comp is in-range at current Series A readiness.",
      "Offer deadline in 14 days — timeline is tight.",
      "Pathao/bKash scale experience maps to next-stage infra needs.",
    ],
    against: [
      "No reference calls completed — highest-signal data point missing.",
      "Comp finalisation depends on equity, which depends on Series A close.",
      "Interview process not completed for either candidate.",
      "Second candidate may be a stronger culture fit — not yet assessed.",
    ],
    ask: "Want me to write the reference check questions based on the interview design captures?",
  },
]

export const GENERIC_DECISION: Omit<SpaceDecision, "match"> = {
  question: "What decision is this space trying to answer?",
  optionA: { label: "Move forward now", note: "Inferred default" },
  optionB: { label: "Wait for more signal", note: "Not yet modelled" },
  for: [
    "You have solid coverage across several subspaces.",
    "Some gaps may be answerable from sources already captured.",
  ],
  against: [
    "Critical gaps remain unanswered.",
    "Synthesis hasn't been written down yet.",
  ],
  ask: "Want Misir to draft the decision frame based on what you've captured?",
}

export function getDecisionForSpace(space: Space | undefined): Omit<SpaceDecision, "match"> {
  if (!space) return GENERIC_DECISION
  const hit = SPACE_DECISIONS.find((d) => d.match.test(space.name))
  return hit ?? GENERIC_DECISION
}
