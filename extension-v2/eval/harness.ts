/**
 * Eval harness: loads the corpus + fixtures, embeds them through the REAL Nomic
 * model, and runs each fixture through the production matcher (findBestMatch +
 * the real wink-nlp pre-processing). Mirrors the exact wiring in
 * src/background/index.ts (semanticScores → findBestMatch) so the numbers here
 * reflect what the extension actually does.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { findBestMatch } from '../src/lib/matching'
import { processText } from '../src/lib/nlp'
import type { Marker, Space, SubspaceWithMarkers } from '../src/lib/types'
import { cosine, embedDocument, embedQuery } from './embed'

const HERE = dirname(fileURLToPath(import.meta.url))
const readJson = (name: string) => JSON.parse(readFileSync(join(HERE, name), 'utf8'))

// ── Corpus JSON → the typed shapes the matcher expects ───────────────────────
interface CorpusMarker { label: string; weight?: number }
interface CorpusSub { id: number; name: string; description?: string; markers: (string | CorpusMarker)[] }
interface CorpusSpace { id: number; name: string; goal?: string; description?: string; subspaces: CorpusSub[] }

const NOW = new Date(0)

export interface LoadedCorpus {
  spaces: Space[]
  subspaces: SubspaceWithMarkers[]
  /** name → id lookups so fixtures can express expectations in human terms. */
  spaceByName: Map<string, number>
  subByName: Map<string, number>
}

export function loadCorpus(): LoadedCorpus {
  const raw = readJson('corpus.json') as { spaces: CorpusSpace[] }
  const spaces: Space[] = []
  const subspaces: SubspaceWithMarkers[] = []
  const spaceByName = new Map<string, number>()
  const subByName = new Map<string, number>()
  let markerId = 1

  for (const cs of raw.spaces) {
    spaces.push({
      id: cs.id, userId: 'eval', name: cs.name,
      description: cs.description, goal: cs.goal, createdAt: NOW, updatedAt: NOW,
    })
    spaceByName.set(cs.name, cs.id)

    for (const sub of cs.subspaces) {
      const markers: Marker[] = sub.markers.map((m) => {
        const label = typeof m === 'string' ? m : m.label
        const weight = typeof m === 'string' ? 1 : m.weight ?? 1
        return { id: markerId++, spaceId: cs.id, userId: 'eval', label, weight, createdAt: NOW }
      })
      subspaces.push({
        id: sub.id, spaceId: cs.id, userId: 'eval', name: sub.name,
        description: sub.description, artifactCount: 0, confidence: 1,
        markerIds: markers.map((m) => m.id), markers, createdAt: NOW, updatedAt: NOW,
      })
      subByName.set(sub.name, sub.id)
    }
  }
  return { spaces, subspaces, spaceByName, subByName }
}

// ── Document text — IDENTICAL to src/background/index.ts ──────────────────────
function subspaceDocText(s: SubspaceWithMarkers): string {
  const markers = s.markers.map((m) => m.label).join(', ')
  return [s.name, s.description ?? '', markers].filter(Boolean).join('. ')
}
function spaceDocText(space: Space, members: SubspaceWithMarkers[]): string {
  const labels = new Set<string>()
  for (const s of members) for (const m of s.markers) labels.add(m.label)
  return [space.name, space.goal ?? '', space.description ?? '', Array.from(labels).join(', ')]
    .filter(Boolean)
    .join('. ')
}

export interface Vectors {
  bySub: Map<number, number[]>
  bySpaceVec: Map<number, number[]>
}

/** Embed every subspace + space document once. Slow (WASM); do it in beforeAll. */
export async function buildVectors(c: LoadedCorpus): Promise<Vectors> {
  const bySub = new Map<number, number[]>()
  const bySpaceVec = new Map<number, number[]>()
  const membersBySpace = new Map<number, SubspaceWithMarkers[]>()
  for (const s of c.subspaces) {
    const arr = membersBySpace.get(s.spaceId) ?? []
    arr.push(s)
    membersBySpace.set(s.spaceId, arr)
  }
  for (const s of c.subspaces) bySub.set(s.id, await embedDocument(subspaceDocText(s)))
  for (const space of c.spaces) {
    bySpaceVec.set(space.id, await embedDocument(spaceDocText(space, membersBySpace.get(space.id) ?? [])))
  }
  return { bySub, bySpaceVec }
}

export interface EvalCase {
  id: string
  note?: string
  text: string
  expect: { space: string; subspace: string } | null
}

export function loadFixtures(): EvalCase[] {
  return (readJson('fixtures.json') as { fixtures: EvalCase[] }).fixtures
}

export interface MatchOutcome {
  matched: boolean
  spaceId: number | null
  subspaceId: number | null
  subspaceName: string | null
  confidence: number | null
  /** The matcher's per-candidate reasoning — invaluable for diagnosing a miss. */
  debug: string[]
}

/** Run one fixture through the production matcher, mirroring computeMatch(). */
export async function runCase(
  c: LoadedCorpus,
  v: Vectors,
  text: string,
): Promise<MatchOutcome> {
  const qVec = await embedQuery(text)
  const bySubspace = new Map<number, number>()
  const bySpace = new Map<number, number>()
  for (const [id, vec] of v.bySub) bySubspace.set(id, cosine(qVec, vec))
  for (const [id, vec] of v.bySpaceVec) bySpace.set(id, cosine(qVec, vec))

  const debug: string[] = []
  const match = findBestMatch(text, processText(text), c.subspaces, {
    semanticById: bySubspace,
    semanticBySpace: bySpace,
    debug: (m) => debug.push(m),
  })
  if (!match) return { matched: false, spaceId: null, subspaceId: null, subspaceName: null, confidence: null, debug }
  return {
    matched: true,
    spaceId: match.subspace.spaceId,
    subspaceId: match.subspace.id,
    subspaceName: match.subspace.name,
    confidence: match.confidence,
    debug,
  }
}
