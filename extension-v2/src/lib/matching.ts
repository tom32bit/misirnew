/**
 * Subspace matching - find the best subspace for an artifact
 * Ported from old extension
 */

import type { SubspaceWithMarkers } from '@/lib/types'
import type { NLPResult } from './nlp'

export interface MatchResult {
  subspace: SubspaceWithMarkers
  matchedMarkerIds: number[]
  confidence: number
}

// Scores within this margin are treated as ties, broken by subspace-name match.
// Minimum combined confidence for the winning subspace to count as a match.
const MATCH_THRESHOLD = 0.45

// Space selection is driven by SEMANTIC similarity, which the logs show is the
// reliable signal: a real tea page scores Tea 0.72–0.78 at the space level,
// clearly above the other spaces, while off-topic noise sits ~0.50–0.53 and
// doesn't separate. Keyword coverage is NOT used to pick the space — generic
// markers ("storage", "water", "brew") let the wrong space in (a C page hit
// tea's "storage"; an herbal-tea page hit coffee's brewing markers).
//
// Two gates on the top space, both on its semantic score:
//   FLOOR  — must be genuinely on-topic (real ≥0.60, noise ≤0.53).
//   MARGIN — must clearly beat the runner-up space; an ambiguous page that
//            resembles two spaces equally (small gap) is left unmatched.
const SEMANTIC_FLOOR = 0.60
const SPACE_MARGIN = 0.07

// Semantically ADJACENT spaces (e.g. "Good Coffee" vs "Good Tea") can sit inside
// SPACE_MARGIN even for a page that clearly belongs to one of them. Rather than
// bail on that near-tie, break it with LEXICAL evidence: if the top space has at
// least this many MORE distinct evidence terms than the runner-up (and higher
// keyword coverage), trust it. A page ambiguous on BOTH signals still gets no
// match, so precision is preserved. (See the coffee/tea cases in eval/.)
const SPACE_LEX_TIEBREAK_MARGIN = 3

// Subspace pick: subspaces of one space are all on-topic and their semantic
// scores sit VERY close (real logs show ~6 siblings inside an 8-point band, which
// Nomic can't separate reliably). So keyword carries real weight here (0.25) —
// both to discriminate among near-tied siblings, and so the correction feedback
// loop's learned markers can actually move a bunched ranking. Topic still leads
// (0.75), and distinctiveness + the single-marker de-rate below keep an incidental
// or lone marker from hijacking the pick.
const SUBSPACE_SEMANTIC_WEIGHT = 0.75

// A subspace corroborated by only ONE marker is low-confidence (a single
// distinctive term that happens to appear can inflate its keyword score). Halve
// its keyword contribution so broad corroboration wins over a lone-marker fluke.
const SINGLE_MARKER_DERATE = 0.5

// Minimum distinct marker hits for lexical evidence. Used at EVERY stage:
//   pre-gate — skip the (WASM) embedding for a page that hits NO space's markers;
//   stage 1  — a space is eligible only if ≥1 of its markers appears;
//   stage 2  — a subspace must have ≥1 marker hit to win (else it's a fallback).
// Semantic still ranks within each gated set — keyword only decides eligibility.
const PREGATE_MIN_HITS = 1

// A marker counts as "present" only at this strength (whole-word / lemma /
// entity hit), so partial or fuzzy overlaps don't inflate the count.
const MARKER_HIT_STRENGTH = 0.5

export interface MatchOptions {
  /** cosine similarity per subspace id; when present, matching goes semantic. */
  semanticById?: Map<number, number>
  /**
   * cosine similarity per SPACE id, from a dedicated space-level document
   * (space name + goal + all markers). A cleaner space signal than averaging
   * the member subspaces' scores — used for the stage-1 space decision. Falls
   * back to the subspace mean when a space vector is missing.
   */
  semanticBySpace?: Map<number, number>
  debug?: (msg: string) => void
}

function nameTokens(name: string): string[] {
  return name.toLowerCase().split(/[\s\-_,./()+]+/).filter((t) => t.length >= 3)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find the best matching subspace for a piece of content — in two stages.
 *
 * The data is hierarchical: a page belongs to a *space* (e.g. "Guava") far more
 * decisively than to any one *subspace* ("guava beverages"). Scoring all
 * subspaces flat lets an unrelated space's subspaces (Coffee) sit close to the
 * right ones on marginal scores. So we:
 *
 *   1. Pick the SPACE — among spaces that have lexical evidence (≥1 marker hit),
 *      take the strongest semantic match (gated by floor + margin). A space that
 *      only resembles the page in embedding space, with no keyword corroboration,
 *      is not eligible.
 *   2. Pick the SUBSPACE — rank the winning space's subspaces by semantic + a
 *      light keyword term, but PREFER one that has lexical evidence: a subspace
 *      with zero marker hits can't win over an evidenced one (only a fallback if
 *      none are evidenced).
 *
 * Lexical evidence gates every stage; semantic ranks within each gated set.
 * Coffee subspaces never compete with Guava ones for the final pick.
 */
export function findBestMatch(
  text: string,
  nlpResult: NLPResult,
  subspaces: SubspaceWithMarkers[],
  opts: MatchOptions = {}
): MatchResult | null {
  const { semanticById, semanticBySpace, debug } = opts
  const useSemantic = !!semanticById
  if (subspaces.length === 0) return null

  const lower = text.toLowerCase()

  // Group subspaces by their parent space.
  const bySpace = new Map<number, SubspaceWithMarkers[]>()
  for (const s of subspaces) {
    const arr = bySpace.get(s.spaceId) ?? []
    arr.push(s)
    bySpace.set(s.spaceId, arr)
  }

  // ── Stage 1: pick the space by semantic similarity, gated by floor + margin ──
  // Semantic (not keyword) chooses the space — the logs show it's the reliable
  // signal, whereas generic markers ("storage", "brew") pull in the wrong space.
  type SpaceCand = { members: SubspaceWithMarkers[]; semSpace: number; kw: number; hits: number }
  const spaces: SpaceCand[] = []

  for (const [spaceId, members] of bySpace) {
    // Prefer the dedicated space-level document vector; fall back to the mean of
    // this space's subspace vectors if it's missing.
    const sems = members.map((m) => semanticById?.get(m.id) ?? 0)
    const meanSem = sems.reduce((a, b) => a + b, 0) / (sems.length || 1)
    const semSpace = useSemantic ? semanticBySpace?.get(spaceId) ?? meanSem : 0
    const kwSpace = spaceKeywordCoverage(lower, nlpResult, members)
    const hits = lexicalEvidenceCount(lower, nlpResult, members)

    if (debug) {
      const semStr = useSemantic ? `sem ${(semSpace * 100).toFixed(0)}%, ` : ''
      debug(`Space ${spaceId}: ${semStr}kw ${(kwSpace * 100).toFixed(0)}%, ${hits} evidence term${hits === 1 ? '' : 's'}, ${members.length} subspaces`)
    }

    spaces.push({ members, semSpace, kw: kwSpace, hits })
  }

  // Lexical gate (stage 1): a space is eligible only if at least one of its
  // markers actually appears on the page. Semantic then ranks the eligible
  // spaces — but a space that merely *looks* similar in embedding space with
  // zero keyword corroboration can't win. The pre-gate guarantees ≥1 eligible,
  // so the fallback to all is only ever a safety net.
  const eligible = spaces.filter((c) => c.hits >= PREGATE_MIN_HITS)
  const pool = eligible.length ? eligible : spaces
  if (debug && eligible.length < spaces.length) {
    debug(`  lexical gate: ${eligible.length}/${spaces.length} space(s) have keyword evidence`)
  }

  // Rank the eligible spaces by the reliable signal: semantic when available,
  // keyword otherwise.
  const rankKey = (c: SpaceCand) => (useSemantic ? c.semSpace : c.kw)
  pool.sort((a, b) => rankKey(b) - rankKey(a))
  const winner = pool[0]
  const runnerUp = pool[1]

  if (useSemantic) {
    // Floor: the page must be genuinely on-topic for the best space.
    if (winner.semSpace < SEMANTIC_FLOOR) {
      if (debug) debug(`  best space ${(winner.semSpace * 100).toFixed(0)}% < floor ${(SEMANTIC_FLOOR * 100).toFixed(0)}% → no match`)
      return null
    }
    // Margin: a genuine match pulls ONE space clearly ahead. An unrelated (or
    // genuinely ambiguous) page resembles two spaces about equally — small gap.
    if (runnerUp && winner.semSpace - runnerUp.semSpace < SPACE_MARGIN) {
      // Before giving up, try to break the semantic near-tie with lexical
      // evidence — adjacent spaces (Coffee vs Tea) confuse the embedder even when
      // the keywords clearly point one way. Only rescue when the winner leads on
      // BOTH evidence-term count and keyword coverage; otherwise it's genuinely
      // ambiguous and we leave it unmatched (precision over recall).
      const lexDecisive =
        winner.hits >= runnerUp.hits + SPACE_LEX_TIEBREAK_MARGIN && winner.kw > runnerUp.kw
      if (!lexDecisive) {
        if (debug) debug(`  no clear space — best ${(winner.semSpace * 100).toFixed(0)}% vs runner-up ${(runnerUp.semSpace * 100).toFixed(0)}% (< ${(SPACE_MARGIN * 100).toFixed(0)}pt), lexical inconclusive (${winner.hits} vs ${runnerUp.hits} terms) → no match`)
        return null
      }
      if (debug) debug(`  semantic near-tie (${(winner.semSpace * 100).toFixed(0)}% vs ${(runnerUp.semSpace * 100).toFixed(0)}%) broken by lexical evidence — winner has ${winner.hits} vs ${runnerUp.hits} evidence terms, kw ${(winner.kw * 100).toFixed(0)}% vs ${(runnerUp.kw * 100).toFixed(0)}%`)
    }
  } else if (winner.kw <= 0) {
    return null // keyword-only fallback: need some marker evidence
  }

  // ── Stage 2: choose the subspace within the winning space ───────────────────
  return rankSubspaces(text, lower, nlpResult, winner.members, semanticById, debug)
}

/**
 * Cheap lexical pre-gate: does ANY space have keyword evidence on this page?
 * Uses only Readability text + wink NLP (no embedding), so callers can skip the
 * expensive on-device embedding entirely for pages that can't match anything.
 */
export function hasKeywordEvidence(
  text: string,
  nlpResult: NLPResult,
  subspaces: SubspaceWithMarkers[],
): boolean {
  const lower = text.toLowerCase()
  const bySpace = new Map<number, SubspaceWithMarkers[]>()
  for (const s of subspaces) {
    const arr = bySpace.get(s.spaceId) ?? []
    arr.push(s)
    bySpace.set(s.spaceId, arr)
  }
  for (const members of bySpace.values()) {
    if (lexicalEvidenceCount(lower, nlpResult, members) >= PREGATE_MIN_HITS) return true
  }
  return false
}

// Generic words that recur across product/feature descriptions and carry no
// topical signal — excluded so they don't create false lexical evidence.
const EVIDENCE_STOP = new Set([
  'app', 'apps', 'tool', 'tools', 'system', 'systems', 'platform', 'platforms',
  'hub', 'hubs', 'module', 'modules', 'management', 'managing', 'tracking',
  'integrated', 'centralized', 'comprehensive', 'customizable', 'resource',
  'resources', 'dashboard', 'dashboards', 'workflow', 'workflows', 'efficiency',
  'coordination', 'submission', 'solution', 'solutions', 'feature', 'features',
  'service', 'services', 'data', 'information', 'online', 'digital', 'various',
  'with', 'and', 'the', 'for', 'from', 'this', 'that', 'your', 'their', 'using',
])

// The significant lexical terms that identify a subspace's topic: its marker
// labels, plus the meaningful words mined from its name and description. Markers
// generated by the space LLM are often multi-word feature phrases that never
// appear verbatim on a page, so mining the name/description recovers the actual
// topical vocabulary ("MBBS", "clinical", "curriculum") that a relevant page
// will contain — the difference between the gate catching a real match or not.
function subspaceTerms(s: SubspaceWithMarkers): string[] {
  const terms = new Set<string>()
  const mine = (t?: string) => {
    if (!t) return
    for (const w of t.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 4 && !EVIDENCE_STOP.has(w)) terms.add(w)
    }
  }
  for (const m of s.markers) {
    terms.add(m.label.toLowerCase()) // full phrase (multi-word boundary match)
    mine(m.label)
  }
  mine(s.name)
  mine(s.description)
  return Array.from(terms)
}

/**
 * How many DISTINCT topical terms of these subspaces appear on the page — the
 * lexical-evidence signal that gates every stage. Counts marker labels AND words
 * mined from subspace names/descriptions, so a page whose vocabulary matches the
 * topic (but not the exact LLM-generated markers) still registers as evidence.
 */
function lexicalEvidenceCount(
  lower: string,
  nlpResult: NLPResult,
  members: SubspaceWithMarkers[],
): number {
  const seen = new Set<string>()
  let hits = 0
  for (const s of members) {
    for (const term of subspaceTerms(s)) {
      if (seen.has(term)) continue
      seen.add(term)
      if (scoreMarker(lower, nlpResult, { label: term, weight: 1 }) >= MARKER_HIT_STRENGTH) hits++
    }
  }
  return hits
}

/** How many of a subspace's OWN markers (not name/description) appear on the
 *  page — the breadth of marker corroboration, used for the single-marker
 *  de-rate. */
function subspaceMarkerHits(lower: string, nlpResult: NLPResult, subspace: SubspaceWithMarkers): number {
  const seen = new Set<string>()
  let hits = 0
  for (const m of subspace.markers) {
    const key = m.label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (scoreMarker(lower, nlpResult, { label: m.label, weight: 1 }) >= MARKER_HIT_STRENGTH) hits++
  }
  return hits
}

/**
 * Rank subspaces within a single space and return the best above threshold.
 * Distinctiveness (markers and name tokens) is computed among these siblings.
 */
function rankSubspaces(
  text: string,
  lower: string,
  nlpResult: NLPResult,
  subspaces: SubspaceWithMarkers[],
  semanticById: Map<number, number> | undefined,
  debug?: (msg: string) => void,
): MatchResult | null {
  const useSemantic = !!semanticById
  const total = subspaces.length

  // Marker distinctiveness within this space: a label on every subspace (e.g.
  // "guava") carries little signal. 1 = unique to one subspace, →0 = on all.
  const labelFreq = new Map<string, number>()
  for (const s of subspaces) {
    for (const l of new Set(s.markers.map((m) => m.label.toLowerCase()))) {
      labelFreq.set(l, (labelFreq.get(l) ?? 0) + 1)
    }
  }
  const distinctiveness = (label: string): number => {
    if (total <= 1) return 1
    const f = labelFreq.get(label.toLowerCase()) ?? 1
    return Math.max(0, 1 - (f - 1) / (total - 1))
  }

  // Distinctive name tokens among these siblings.
  const tokenFreq = new Map<string, number>()
  const tokensById = new Map<number, string[]>()
  for (const s of subspaces) {
    const toks = Array.from(new Set(nameTokens(s.name)))
    tokensById.set(s.id, toks)
    for (const t of toks) tokenFreq.set(t, (tokenFreq.get(t) ?? 0) + 1)
  }
  const nameScore = (s: SubspaceWithMarkers): number => {
    const toks = tokensById.get(s.id) ?? []
    const distinctive = toks.filter((t) => (tokenFreq.get(t) ?? 0) === 1)
    const use = distinctive.length ? distinctive : toks
    if (use.length === 0) return 0
    return use.filter((t) => lower.includes(t)).length / use.length
  }

  // Track two winners: the best subspace that has lexical evidence, and the best
  // overall. We prefer the former (lexical gate); the latter is only a fallback.
  let bestEvidenced: (MatchResult & { nameScore: number }) | null = null
  let bestAny: (MatchResult & { nameScore: number }) | null = null

  for (const subspace of subspaces) {
    const kwRaw = scoreSubspace(text, nlpResult, subspace, distinctiveness)
    // De-rate a subspace corroborated by only one of its own markers — a lone
    // distinctive term shouldn't outweigh a broadly-corroborated sibling.
    const ownMarkerHits = subspaceMarkerHits(lower, nlpResult, subspace)
    const kw = ownMarkerHits <= 1 ? kwRaw * SINGLE_MARKER_DERATE : kwRaw
    const sem = semanticById?.get(subspace.id) ?? 0
    const score = useSemantic ? SUBSPACE_SEMANTIC_WEIGHT * sem + (1 - SUBSPACE_SEMANTIC_WEIGHT) * kw : kw
    const ns = nameScore(subspace)
    // Lexical evidence for THIS subspace: do any of its topical terms (markers +
    // name/description words) appear on the page? Distinctiveness-weighted `kw`
    // can be 0 even when a term hits, so gate on the raw evidence count instead.
    const hits = lexicalEvidenceCount(lower, nlpResult, [subspace])

    if (debug) {
      const semStr = useSemantic ? `sem ${(sem * 100).toFixed(0)}%, ` : ''
      debug(`  ${subspace.name}: ${(score * 100).toFixed(1)}% (${semStr}kw ${(kw * 100).toFixed(0)}%, name ${(ns * 100).toFixed(0)}%, ${hits} evidence, ${subspace.markers.length} markers)`)
    }

    if (score <= 0) continue

    const candidate = {
      subspace,
      matchedMarkerIds: getMatchedMarkerIds(lower, nlpResult, subspace),
      confidence: score,
      nameScore: ns,
    }

    // Highest combined score wins within each bucket — no name-based tiebreak.
    if (!bestAny || candidate.confidence > bestAny.confidence) bestAny = candidate
    if (hits >= PREGATE_MIN_HITS && (!bestEvidenced || candidate.confidence > bestEvidenced.confidence)) {
      bestEvidenced = candidate
    }
  }

  // Lexical gate (stage 2): prefer the best subspace that has keyword evidence
  // over a higher-semantic one with NONE — so a Kryptonite page can't land in a
  // "Lois Lane roles" subspace that shares zero vocabulary with it. Fall back to
  // the best semantic subspace only when no subspace has any evidence (a
  // space-generation gap), so the confirmed space match isn't lost.
  const best = bestEvidenced ?? bestAny
  if (debug && best) {
    debug(`  → picked "${best.subspace.name}"${bestEvidenced ? ' (lexically corroborated)' : ' (semantic fallback — no subspace had keyword evidence)'}`)
  }

  if (best && best.confidence >= MATCH_THRESHOLD) {
    return { subspace: best.subspace, matchedMarkerIds: best.matchedMarkerIds, confidence: best.confidence }
  }
  return null
}

/**
 * How well a space's markers cover the text — the average marker score across
 * the space's distinct markers (no distinctiveness weighting; this is a
 * space-vs-space signal, not subspace-vs-subspace).
 */
function spaceKeywordCoverage(
  lower: string,
  nlpResult: NLPResult,
  members: SubspaceWithMarkers[],
): number {
  const seen = new Set<string>()
  const markers: Array<{ label: string; weight: number }> = []
  for (const s of members) {
    for (const m of s.markers) {
      const key = m.label.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      markers.push({ label: m.label, weight: m.weight || 1 })
    }
  }
  if (markers.length === 0) return 0

  let sum = 0
  let wsum = 0
  for (const m of markers) {
    const w = m.weight || 1
    wsum += w
    sum += scoreMarker(lower, nlpResult, m) * w
  }
  return wsum ? sum / wsum : 0
}

function scoreSubspace(
  text: string,
  nlpResult: NLPResult,
  subspace: SubspaceWithMarkers,
  distinctiveness: (label: string) => number,
): number {
  if (subspace.markers.length === 0) return 0

  const lowerText = text.toLowerCase()
  let matchWeight = 0
  let totalWeight = 0

  for (const marker of subspace.markers) {
    // A marker's pull is its own weight scaled by how distinctive it is across
    // sibling subspaces — a label shared by all of them contributes ~nothing.
    const w = (marker.weight || 1) * distinctiveness(marker.label)
    if (w <= 0) continue
    totalWeight += w
    matchWeight += scoreMarker(lowerText, nlpResult, marker) * w
  }

  // No distinctive markers, or none present → can't distinguish this subspace.
  if (totalWeight === 0) return 0

  // Weighted average match quality across this subspace's distinctive markers.
  return matchWeight / totalWeight
}

function scoreMarker(lowerText: string, nlpResult: NLPResult, marker: { label: string; weight: number }): number {
  const markerLower = marker.label.toLowerCase().trim()
  if (!markerLower) return 0

  // Whole-word / whole-phrase match — word boundaries so a short marker can't
  // match inside an unrelated word (e.g. "roi" inside "steroid").
  const boundary = new RegExp(`(^|[^a-z0-9])${escapeRegExp(markerLower)}([^a-z0-9]|$)`)
  if (boundary.test(lowerText)) return 1.0

  // Exact token / keyword / entity match (lemmatised words) — no partial overlap.
  if (nlpResult.tokens.includes(markerLower)) return 0.8
  if (nlpResult.keywords.includes(markerLower)) return 0.7
  if (nlpResult.entities.some((e) => e.toLowerCase() === markerLower)) return 0.9

  // Multi-word marker: require most of its significant words to appear as whole
  // words in the text. Single-word markers get no partial credit (avoids noise).
  const markerWords = markerLower.split(/\s+/).filter((w) => w.length > 2)
  if (markerWords.length > 1) {
    const textWords = new Set(lowerText.split(/[^a-z0-9]+/))
    const hits = markerWords.filter((w) => textWords.has(w)).length
    const frac = hits / markerWords.length
    if (frac >= 0.6) return 0.5 * frac
  }

  return 0
}

// Report exactly the markers that scoreMarker counts as hits (same threshold as
// the evidence gates). This used to apply looser criteria — e.g. any >2-char
// word of a multi-word phrase — so matched_marker_ids disagreed with what the
// score was built from, and the backend's per-subspace stats (which attribute
// artifacts by marker-id overlap) were skewed by the phantom matches.
function getMatchedMarkerIds(lowerText: string, nlpResult: NLPResult, subspace: SubspaceWithMarkers): number[] {
  return subspace.markers
    .filter((marker) => scoreMarker(lowerText, nlpResult, marker) >= MARKER_HIT_STRENGTH)
    .map((m) => m.id)
}