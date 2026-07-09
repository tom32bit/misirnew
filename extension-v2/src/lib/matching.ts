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
const TIEBREAK_EPSILON = 0.01

// Minimum confidence to count as a match. Real matches score high (60–98%);
// noise from a single weak marker hit sits ~15–35%, so the floor sits above it.
const MATCH_THRESHOLD = 0.35

// When semantic (on-device embedding) scores are supplied, topic similarity
// leads and keyword coverage refines it: combined = w·semantic + (1-w)·keyword.
//
// Stage 1 (space): keyword coverage of a space's markers is a strong, meaningful
// space signal, so it gets real weight (0.4).
//
// Stage 2 (subspace): the candidates are already all in the right space, so
// they're all on-topic and their semantic scores sit close together. Here a
// stray keyword hit (e.g. a caffeine article mentioning "water"/"mg" lighting up
// the "Water Quality" subspace) is mostly noise, so keyword is demoted to a
// light tie-breaker and topic similarity dominates.
const SPACE_SEMANTIC_WEIGHT = 0.6
const SUBSPACE_SEMANTIC_WEIGHT = 0.8

// A candidate space must clear this floor — stops a page that resembles no space
// from being saved anywhere (off-topic keyword collisions, blank pages).
const SEMANTIC_FLOOR = 0.45

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
 *   1. Pick the SPACE — aggregate each space's signal (mean semantic similarity
 *      + keyword coverage of its markers) and take the strongest. This is a
 *      decisive call: a guava page scores ~63% for Guava vs ~50% for Coffee.
 *   2. Pick the SUBSPACE — rank only the winning space's subspaces, breaking
 *      near-ties on DISTINCTIVE name tokens (words unique to a subspace among
 *      its siblings — "recipe"/"juice" vs the ubiquitous "guava").
 *
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

  // ── Stage 1: choose the space ──────────────────────────────────────────────
  let winner: SubspaceWithMarkers[] | null = null
  let winnerSem = 0
  let winnerScore = -1

  for (const [spaceId, members] of bySpace) {
    // Prefer the dedicated space-level document vector; fall back to the mean of
    // this space's subspace vectors if it's missing.
    const sems = members.map((m) => semanticById?.get(m.id) ?? 0)
    const meanSem = sems.reduce((a, b) => a + b, 0) / (sems.length || 1)
    const semSpace = useSemantic ? semanticBySpace?.get(spaceId) ?? meanSem : 0
    const kwSpace = spaceKeywordCoverage(lower, nlpResult, members)
    const spaceScore = useSemantic ? SPACE_SEMANTIC_WEIGHT * semSpace + (1 - SPACE_SEMANTIC_WEIGHT) * kwSpace : kwSpace

    if (debug) {
      const semStr = useSemantic ? `sem ${(semSpace * 100).toFixed(0)}%, ` : ''
      debug(`Space ${spaceId}: ${(spaceScore * 100).toFixed(1)}% (${semStr}kw ${(kwSpace * 100).toFixed(0)}%, ${members.length} subspaces)`)
    }

    if (spaceScore > winnerScore) {
      winnerScore = spaceScore
      winnerSem = semSpace
      winner = members
    }
  }

  if (!winner) return null

  // Off-topic gate at the SPACE level: if the page doesn't resemble even the
  // best space, don't match it anywhere (kills keyword-collision false matches).
  if (useSemantic && winnerSem < SEMANTIC_FLOOR) {
    if (debug) debug(`  best space below semantic floor (${(SEMANTIC_FLOOR * 100).toFixed(0)}%) → no match`)
    return null
  }

  // ── Stage 2: choose the subspace within the winning space ───────────────────
  return rankSubspaces(text, lower, nlpResult, winner, semanticById, debug)
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

  let best: (MatchResult & { nameScore: number }) | null = null

  for (const subspace of subspaces) {
    const kw = scoreSubspace(text, nlpResult, subspace, distinctiveness)
    const sem = semanticById?.get(subspace.id) ?? 0
    const score = useSemantic ? SUBSPACE_SEMANTIC_WEIGHT * sem + (1 - SUBSPACE_SEMANTIC_WEIGHT) * kw : kw
    const ns = nameScore(subspace)

    if (debug) {
      const semStr = useSemantic ? `sem ${(sem * 100).toFixed(0)}%, ` : ''
      debug(`  ${subspace.name}: ${(score * 100).toFixed(1)}% (${semStr}kw ${(kw * 100).toFixed(0)}%, name ${(ns * 100).toFixed(0)}%, ${subspace.markers.length} markers)`)
    }

    if (score <= 0) continue

    const candidate = {
      subspace,
      matchedMarkerIds: getMatchedMarkerIds(nlpResult, subspace),
      confidence: score,
      nameScore: ns,
    }

    if (!best) {
      best = candidate
      continue
    }
    const diff = candidate.confidence - best.confidence
    if (diff > TIEBREAK_EPSILON) {
      best = candidate
    } else if (Math.abs(diff) <= TIEBREAK_EPSILON && candidate.nameScore > best.nameScore) {
      // Marker scores tie → prefer the subspace whose distinctive name matches.
      best = candidate
    }
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

function getMatchedMarkerIds(nlpResult: NLPResult, subspace: SubspaceWithMarkers): number[] {
  const lowerTokens = new Set(nlpResult.tokens)
  const lowerKeywords = new Set(nlpResult.keywords)
  const lowerEntities = new Set(nlpResult.entities.map(e => e.toLowerCase()))

  return subspace.markers
    .filter((marker) => {
      const label = marker.label.toLowerCase()
      return (
        lowerTokens.has(label) ||
        lowerKeywords.has(label) ||
        lowerEntities.has(label) ||
        label.split(/\s+/).some(w => w.length > 2 && (lowerTokens.has(w) || lowerKeywords.has(w)))
      )
    })
    .map(m => m.id)
}