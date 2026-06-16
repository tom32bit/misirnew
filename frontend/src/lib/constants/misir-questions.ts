/**
 * Per-space "Misir asks" question.
 *
 * Ported from `design_handoff_misir/dashboard/views.js` MISIR_QUESTIONS.
 * Each entry binds to a SUBSPACE by name regex (so the question can name
 * the subspace it's "from" even though we generated subspaces are new
 * integer ids in production).
 */

import type { Space, Subspace } from "@/lib/api/types"

export type MisirQuestion = {
  spaceMatch: RegExp
  /** Picks which subspace this question is attributed to. */
  subspaceMatch: RegExp
  context: string
  question: string
  placeholder: string
  /** Per-space canned reply used when the SSE stream fails. */
  fallback: string
}

export const MISIR_QUESTIONS: MisirQuestion[] = [
  {
    spaceMatch: /series\s*a|raise/i,
    subspaceMatch: /gomechanic|forensic|collapse/i,
    context:
      "GoMechanic forensic is at 22%. You've opened it three times this week without answering the question.",
    question:
      "Before you dig further — how does Zantrik avoid the same failure? One sentence.",
    placeholder: "Zantrik avoids it because…",
    fallback:
      "That's the structural answer. The contractual anchor separates Zantrik from GoMechanic — fleet operators can't churn overnight. File this directly. The gap has been stuck at 22% because you kept reading instead of writing down what you already knew.",
  },
  {
    spaceMatch: /roadmap|h2/i,
    subspaceMatch: /release|sequencing|launch/i,
    context:
      "Your release strategy subspace is empty. Board review is in 18 days.",
    question:
      "If you had to sequence your 3 H2 bets right now — what ships first, and why?",
    placeholder: "Fleet API ships first because…",
    fallback:
      "Good instinct on sequencing. The API migration is the unlock — everything else depends on it. What's missing is the estimate: how many weeks does the migration actually take? That's the number the board will pressure-test.",
  },
  {
    spaceMatch: /fleet/i,
    subspaceMatch: /pricing|price/i,
    context:
      "Fleet SaaS pricing is at 18%. You haven't validated a number with a single fleet operator.",
    question:
      "What would a fleet manager pay per vehicle per month without hesitation? What's your gut number?",
    placeholder: "$X per vehicle because…",
    fallback:
      "The price point is a reasonable starting hypothesis. What's missing is one actual conversation — even a 15-minute call with a fleet manager who tells you that number is too high or too low changes everything. No more reading until you have that call.",
  },
  {
    spaceMatch: /hire|vp/i,
    subspaceMatch: /pipeline|candidate/i,
    context:
      "You've reviewed candidate profiles. Offer deadline is in 14 days.",
    question:
      "What's the one thing you'd most want to understand about each candidate before making an offer?",
    placeholder: "For X I want to know… For Y…",
    fallback:
      "Those are the right questions. What's missing is the answer — schedule the reference calls now. The information you're speculating about is available from two phone calls. Stop hypothesising and make the calls.",
  },
]

/**
 * Resolve the question + subspace target for a given space + subspace list.
 * Returns null when nothing matches (caller renders no Misir-asks card).
 */
export function questionForSpace(
  space: Space | undefined,
  subspaces: Subspace[],
): (MisirQuestion & { subspace: Subspace | null }) | null {
  if (!space) return null
  const q = MISIR_QUESTIONS.find((m) => m.spaceMatch.test(space.name))
  if (!q) return null
  const subspace = subspaces.find((s) => q.subspaceMatch.test(s.name)) ?? null
  return { ...q, subspace }
}

export const GENERIC_FALLBACK =
  "That's a start. File it to the subspace and see what's still missing when you look at it next to the other captures."
