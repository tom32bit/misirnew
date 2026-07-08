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

function nameTokens(name: string): string[] {
  return name.toLowerCase().split(/[\s\-_,./()+]+/).filter((t) => t.length >= 3)
}

/**
 * Find the best matching subspace for a piece of content.
 *
 * Marker coverage ranks *spaces* (subspaces in a space share markers, so they
 * tie). To pick the right *subspace*, we break ties on the subspace's
 * DISTINCTIVE name tokens — words unique to that subspace among its siblings.
 * A "Guava" space with subspaces "common guava varieties" and "guava juice
 * recipe" both contain "guava"; ignoring that shared token, a recipe page hits
 * "recipe"/"juice" (distinctive) and not "varieties", so the recipe subspace
 * wins instead of always matching on the ubiquitous "guava".
 */
export function findBestMatch(
  text: string,
  nlpResult: NLPResult,
  subspaces: SubspaceWithMarkers[],
  debug?: (msg: string) => void
): MatchResult | null {
  if (subspaces.length === 0) return null

  const lower = text.toLowerCase()

  // Marker distinctiveness: a marker label shared by many subspaces (e.g.
  // "guava" across every guava subspace) carries almost no signal, so weight it
  // down. 1 = unique to one subspace, →0 = present in all of them.
  const total = subspaces.length
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

  // Count how many subspaces each name token appears in, to find distinctive ones.
  const tokenFreq = new Map<string, number>()
  const tokensById = new Map<number, string[]>()
  for (const s of subspaces) {
    const toks = Array.from(new Set(nameTokens(s.name)))
    tokensById.set(s.id, toks)
    for (const t of toks) tokenFreq.set(t, (tokenFreq.get(t) ?? 0) + 1)
  }

  function nameScore(s: SubspaceWithMarkers): number {
    const toks = tokensById.get(s.id) ?? []
    // Prefer tokens unique to this subspace; fall back to all if none are unique.
    const distinctive = toks.filter((t) => (tokenFreq.get(t) ?? 0) === 1)
    const use = distinctive.length ? distinctive : toks
    if (use.length === 0) return 0
    return use.filter((t) => lower.includes(t)).length / use.length
  }

  let best: (MatchResult & { nameScore: number }) | null = null

  for (const subspace of subspaces) {
    const score = scoreSubspace(text, nlpResult, subspace, distinctiveness)
    if (score <= 0) continue
    const ns = nameScore(subspace)

    if (debug) {
      debug(`  ${subspace.name}: ${(score * 100).toFixed(1)}% (name ${(ns * 100).toFixed(0)}%, ${subspace.markers.length} markers)`)
    }

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

  // Minimum threshold for a match
  if (best && best.confidence >= 0.15) {
    return { subspace: best.subspace, matchedMarkerIds: best.matchedMarkerIds, confidence: best.confidence }
  }

  return null
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
  const markerLower = marker.label.toLowerCase()

  // Exact phrase match in text (highest confidence)
  if (lowerText.includes(markerLower)) {
    return 1.0
  }

  // Check tokens
  for (const token of nlpResult.tokens) {
    if (token === markerLower || token.includes(markerLower) || markerLower.includes(token)) {
      return 0.8
    }
  }

  // Check keywords
  for (const keyword of nlpResult.keywords) {
    if (keyword === markerLower || keyword.includes(markerLower) || markerLower.includes(keyword)) {
      return 0.7
    }
  }

  // Check entities
  for (const entity of nlpResult.entities) {
    if (entity.toLowerCase() === markerLower || entity.toLowerCase().includes(markerLower)) {
      return 0.9
    }
  }

  // Fuzzy match: marker words appear in text
  const markerWords = markerLower.split(/\s+/).filter(w => w.length > 2)
  const textWords = new Set(lowerText.split(/\s+/))
  const wordMatches = markerWords.filter(w => textWords.has(w)).length

  if (markerWords.length > 0 && wordMatches / markerWords.length >= 0.5) {
    return 0.5 * (wordMatches / markerWords.length)
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