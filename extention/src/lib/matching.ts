import type { SubspaceWithMarkers } from '@/types'
import type { NLPResult } from './nlp'

// Minimum fraction of a subspace's marker vocabulary that must appear in the
// page text for a capture to be considered. 0.5 = at least half the marker
// tokens must be present.
const STAGE2_THRESHOLD = 0.2

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
    debug?.(`  ${subspace.name}: Stage1 pass, coverage=${(score * 100).toFixed(0)}% (threshold ${STAGE2_THRESHOLD * 100}%)`)

    if (score < STAGE2_THRESHOLD) continue

    candidates.push({ subspace, matchedMarkerIds, confidence: score, stageMatchedAt: 2 })
  }

  if (candidates.length === 0) return null

  return candidates.reduce((best, curr) => (curr.confidence > best.confidence ? curr : best))
}
