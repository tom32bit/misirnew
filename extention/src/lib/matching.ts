import type { SubspaceWithMarkers } from '@/types'
import type { NLPResult } from './nlp'

// Minimum fraction of a subspace's marker vocabulary that must appear in the
// page text for a capture to be considered. 0.5 = at least half the marker
// tokens must be present.
const STAGE2_THRESHOLD = 0.2

// If two candidates' coverage scores are within this margin, fall back to
// name-match scoring as the tiebreaker. All subspaces in the same space share
// identical markers, so they produce identical coverage scores — name-matching
// is the only way to pick the most semantically relevant one.
const TIEBREAK_EPSILON = 0.01

// Tokens shorter than this are too generic to be meaningful signals on their own.
const MIN_TOKEN_LENGTH = 4

function tokenize(label: string): string[] {
  return label
    .toLowerCase()
    .split(/[\s\-_,./()+]+/)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH)
}

// Stage 1: fast filter — at least one meaningful marker token must appear in text.
function matchMarkers(textContent: string, subspace: SubspaceWithMarkers): number[] {
  if (subspace.markers.length === 0) return []
  const lower = textContent.toLowerCase()

  return subspace.markers.filter((m) => {
    const label = m.label.toLowerCase()
    if (lower.includes(label)) return true
    return tokenize(label).some((t) => lower.includes(t))
  }).map((m) => m.id)
}

// Stage 2: what fraction of the subspace's marker vocabulary is present in the page?
// Compares raw marker tokens against raw page text — avoids lemmatization
// mismatches that occurred when comparing NLP lemmas against raw marker tokens
// (e.g. marker "qubits" vs NLP lemma "qubit" never intersected).
function scoreMarkerCoverage(textContent: string, subspace: SubspaceWithMarkers): number {
  if (subspace.markers.length === 0) return 0

  const lower = textContent.toLowerCase()

  const allTokens = [
    ...new Set(subspace.markers.flatMap((m) => tokenize(m.label))),
  ]
  if (allTokens.length === 0) return 0

  const matched = allTokens.filter((t) => lower.includes(t)).length
  return matched / allTokens.length
}

// Tiebreaker: fraction of subspace name tokens that appear in the page text.
// All subspaces in a space share the same markers and produce identical coverage
// scores, so we use the subspace name as a secondary relevance signal.
function scoreNameMatch(textContent: string, subspaceName: string): number {
  const tokens = tokenize(subspaceName)
  if (tokens.length === 0) return 0
  const lower = textContent.toLowerCase()
  const matched = tokens.filter((t) => lower.includes(t)).length
  return matched / tokens.length
}

export interface MatchResult {
  subspace: SubspaceWithMarkers
  matchedMarkerIds: number[]
  confidence: number
  stageMatchedAt: 2
}

export function findBestMatch(
  textContent: string,
  nlpResult: NLPResult,
  subspaces: SubspaceWithMarkers[],
  debug?: (msg: string) => void,
): MatchResult | null {
  const candidates: MatchResult[] = []

  for (const subspace of subspaces) {
    const matchedMarkerIds = matchMarkers(textContent, subspace)
    if (matchedMarkerIds.length === 0) {
      debug?.(`  ${subspace.name}: Stage1 FAIL — no marker tokens found`)
      continue
    }

    const score = scoreMarkerCoverage(textContent, subspace)
    const nameScore = scoreNameMatch(textContent, subspace.name)

    if (score < STAGE2_THRESHOLD) {
      debug?.(`  ${subspace.name}: Stage2 FAIL — coverage=${(score * 100).toFixed(0)}% < threshold ${STAGE2_THRESHOLD * 100}%`)
      continue
    }

    debug?.(`  ${subspace.name}: pass — coverage=${(score * 100).toFixed(0)}%, name=${(nameScore * 100).toFixed(0)}%`)
    candidates.push({ subspace, matchedMarkerIds, confidence: score, stageMatchedAt: 2 })
  }

  if (candidates.length === 0) return null

  return candidates.reduce((best, curr) => {
    const diff = curr.confidence - best.confidence
    if (Math.abs(diff) > TIEBREAK_EPSILON) {
      return diff > 0 ? curr : best
    }
    // Scores too close — prefer whichever subspace name matches the content better.
    const nameA = scoreNameMatch(textContent, best.subspace.name)
    const nameB = scoreNameMatch(textContent, curr.subspace.name)
    return nameB > nameA ? curr : best
  })
}
