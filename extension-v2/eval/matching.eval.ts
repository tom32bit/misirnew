/**
 * Matching eval — the regression gate for match quality.
 *
 * Unlike src/lib/matching.test.ts (fast, mocked cosines, logic-only), this runs
 * the fixtures through the REAL on-device Nomic model and the REAL matcher, then
 * scores precision/recall. It is intentionally NOT part of `npm test`: it
 * downloads ~140 MB on first run and takes a while. Run it deliberately:
 *
 *     npm run eval
 *
 * When you fix or report a mis-match, add a fixture in eval/fixtures.json — that
 * case then guards the fix forever. Tune matching constants against the SCORE
 * this prints, not a single anecdote.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  buildVectors, loadCorpus, loadFixtures, runCase,
  type EvalCase, type LoadedCorpus, type MatchOutcome, type Vectors,
} from './harness'

// Guard rails — the floor the matcher must clear, not a target. Baseline
// observed 2026-07-11 against the REAL exported corpus (7 spaces, ~40 subspaces)
// and the real Nomic model: 100% space, 100% subspace, zero false positives
// across 18 fixtures. Floors sit just below that so a single genuine regression
// trips the run; raise them further as quality improves so gains can't silently
// slip back. Adjust with intent.
const SPACE_ACCURACY_MIN = 0.9    // of cases that SHOULD match, right space
const SUBSPACE_ACCURACY_MIN = 0.85 // of cases that SHOULD match, right subspace

interface Scored {
  c: EvalCase
  out: MatchOutcome
  expectedSpaceId: number | null
  expectedSubId: number | null
  spaceOk: boolean
  subOk: boolean
  falsePositive: boolean
  falseNegative: boolean
}

let corpus: LoadedCorpus
let scored: Scored[] = []

beforeAll(async () => {
  corpus = loadCorpus()
  const vectors: Vectors = await buildVectors(corpus)
  const fixtures = loadFixtures()
  scored = []
  for (const c of fixtures) {
    const out = await runCase(corpus, vectors, c.text)
    const expectedSpaceId = c.expect ? corpus.spaceByName.get(c.expect.space) ?? null : null
    const expectedSubId = c.expect ? corpus.subByName.get(c.expect.subspace) ?? null : null
    const shouldMatch = c.expect !== null
    scored.push({
      c, out, expectedSpaceId, expectedSubId,
      spaceOk: shouldMatch && out.matched && out.spaceId === expectedSpaceId,
      subOk: shouldMatch && out.matched && out.subspaceId === expectedSubId,
      falsePositive: !shouldMatch && out.matched,
      falseNegative: shouldMatch && !out.matched,
    })
  }
}, 300_000) // first run downloads the model — give it room

afterAll(() => {
  const row = (s: Scored) => {
    const want = s.c.expect ? `${s.c.expect.space} › ${s.c.expect.subspace}` : '— (no match)'
    const got = s.out.matched
      ? `${s.out.subspaceName} @ ${((s.out.confidence ?? 0) * 100).toFixed(0)}%`
      : '— (no match)'
    const verdict = s.falsePositive ? 'FALSE-POS'
      : s.falseNegative ? 'MISS'
      : s.c.expect === null ? 'ok (rejected)'
      : s.subOk ? 'ok' : s.spaceOk ? 'wrong-subspace' : 'wrong-space'
    return { case: s.c.id, expected: want, got, verdict }
  }
  // eslint-disable-next-line no-console
  console.log('\n=== Matching eval scorecard ===')
  // eslint-disable-next-line no-console
  console.table(scored.map(row))

  // For anything that missed or landed wrong, dump the matcher's reasoning so the
  // cause (floor? margin? wrong sibling?) is visible without a second run.
  const wrong = scored.filter((s) => s.falsePositive || s.falseNegative || (s.c.expect && !s.subOk))
  if (wrong.length) {
    // eslint-disable-next-line no-console
    console.log('\n=== Why the misses happened ===')
    for (const s of wrong) {
      // eslint-disable-next-line no-console
      console.log(`\n• ${s.c.id} — expected ${s.c.expect ? `${s.c.expect.space} › ${s.c.expect.subspace}` : 'no match'}`)
      for (const line of s.out.debug) console.log(`    ${line}`) // eslint-disable-line no-console
    }
  }
})

describe('matching quality', () => {
  it('never matches a true-negative page (precision)', () => {
    const leaks = scored.filter((s) => s.falsePositive)
    expect(leaks.map((s) => `${s.c.id} → ${s.out.subspaceName}`)).toEqual([])
  })

  it(`routes the right space in ≥${SPACE_ACCURACY_MIN * 100}% of matchable cases`, () => {
    const matchable = scored.filter((s) => s.c.expect !== null)
    const ok = matchable.filter((s) => s.spaceOk).length
    const acc = ok / (matchable.length || 1)
    // eslint-disable-next-line no-console
    console.log(`space accuracy: ${ok}/${matchable.length} = ${(acc * 100).toFixed(0)}%`)
    expect(acc).toBeGreaterThanOrEqual(SPACE_ACCURACY_MIN)
  })

  it(`routes the right subspace in ≥${SUBSPACE_ACCURACY_MIN * 100}% of matchable cases`, () => {
    const matchable = scored.filter((s) => s.c.expect !== null)
    const ok = matchable.filter((s) => s.subOk).length
    const acc = ok / (matchable.length || 1)
    // eslint-disable-next-line no-console
    console.log(`subspace accuracy: ${ok}/${matchable.length} = ${(acc * 100).toFixed(0)}%`)
    expect(acc).toBeGreaterThanOrEqual(SUBSPACE_ACCURACY_MIN)
  })
})
