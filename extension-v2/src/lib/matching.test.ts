import { describe, it, expect } from 'vitest'
import { findBestMatch, hasKeywordEvidence } from './matching'
import type { NLPResult } from './nlp'
import type { Marker, SubspaceWithMarkers } from '@/lib/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────
// These encode the exact regressions we debugged by hand. The matcher's two
// stages (space, then subspace) are driven by SEMANTIC similarity, which in
// production comes from the on-device embedder. Here we inject mock cosine maps
// so the tests are deterministic — no WASM model needed — and exercise the real
// floor / margin / lexical-gate logic.

let _markerId = 1000
function sub(
  id: number,
  spaceId: number,
  name: string,
  description: string,
  markerLabels: string[],
): SubspaceWithMarkers {
  return {
    id,
    spaceId,
    userId: 'u',
    name,
    description,
    artifactCount: 0,
    confidence: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    markers: markerLabels.map((label): Marker => ({
      id: _markerId++,
      spaceId,
      userId: 'u',
      label,
      weight: 1,
      createdAt: new Date(0),
    })),
  }
}

// A plausible NLPResult from raw text: whole-word matching drives the matcher, so
// tokens = the page's distinct words (mirrors what wink would surface, minus
// lemmatization — fixtures use words that appear verbatim to stay deterministic).
function nlpOf(text: string): NLPResult {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
  const tokens = Array.from(new Set(words))
  return { tokens, keywords: tokens.slice(0, 25), entities: [] }
}

function sem(
  spaceScores: Record<number, number>,
  subScores: Record<number, number>,
) {
  return {
    semanticBySpace: new Map(Object.entries(spaceScores).map(([k, v]) => [Number(k), v])),
    semanticById: new Map(Object.entries(subScores).map(([k, v]) => [Number(k), v])),
  }
}

// ── Spaces ────────────────────────────────────────────────────────────────────

// Superman (space 1)
const kryptoniteSub = sub(
  10, 1, 'Kryptonite',
  "The radioactive green rock from the planet Krypton — Superman's greatest weakness, a glowing mineral.",
  ['kryptonite', 'krypton'],
)
const loisSub = sub(
  11, 1, 'Lois Lane and Alfred Pennyworth roles',
  'Supporting cast: the reporter Lois Lane and the butler Alfred Pennyworth and their relationships.',
  ['lois lane', 'alfred pennyworth'],
)

// Medical Education App (space 2) — markers are flowery feature phrases (as the
// space generator writes them); the real vocabulary lives in name/description.
const curriculumSub = sub(
  20, 2, 'Core Curriculum Management',
  'Centralized tracking of MBBS syllabi, lecture schedules, and academic milestones.',
  ['syllabus tracking', 'lecture schedule'],
)
const examSub = sub(
  21, 2, 'Exam Preparation Hub',
  'Question banks, past-paper analysis, and dashboards for medical licensing exams.',
  ['question bank', 'past paper'],
)
const clinicalSub = sub(
  22, 2, 'Clinical Skills Training',
  'Virtual patient simulations, OSCE preparation, and procedural competency for clinical training.',
  ['osce preparation', 'clinical competency'],
)

// Tea (space 3)
const brewingSub = sub(
  30, 3, 'Brewing techniques',
  'Steeping time, water temperature, and brewing method for the perfect cup.',
  ['steeping', 'temperature'],
)
const varietiesSub = sub(
  31, 3, 'Tea varieties',
  'Darjeeling, Assam, and Oolong varieties and their flavour profiles.',
  ['darjeeling', 'oolong', 'varieties'],
)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('findBestMatch — precision (lexical gate)', () => {
  it('gates a Kryptonite page OUT of a higher-semantic but zero-vocabulary subspace', () => {
    const text =
      'Kryptonite is a fictional substance from the Superman comic series. Created from the ' +
      'irradiated remains of the planet Krypton, kryptonite is usually a glowing green rock or ' +
      'mineral. Green kryptonite weakens Superman with radiation; red and gold variants exist.'

    // "Lois Lane roles" (11) scores HIGHER semantically than "Kryptonite" (10) —
    // without the lexical gate it would win. But the page shares no vocabulary
    // with it (no lois/lane/alfred), so the gate must exclude it.
    const s = sem({ 1: 0.65 }, { 10: 0.55, 11: 0.68 })
    const result = findBestMatch(text, nlpOf(text), [kryptoniteSub, loisSub], s)

    expect(result).not.toBeNull()
    expect(result!.subspace.id).toBe(10) // Kryptonite, not Lois Lane
    expect(result!.confidence).toBeGreaterThanOrEqual(0.45)
  })
})

describe('findBestMatch — recall (name/description evidence)', () => {
  const mbbsText =
    'User: give me mbbs curriculum. Assistant: The MBBS (Bachelor of Medicine, Bachelor of ' +
    'Surgery) is an undergraduate medical degree. Core subjects include anatomy, physiology, ' +
    'and clinical medicine. Students prepare for licensing exams and clinical skills.'
  const allSubs = [curriculumSub, examSub, clinicalSub, brewingSub, varietiesSub]

  it('finds keyword evidence from names/descriptions even when markers are fluff phrases', () => {
    // Pre-gate must pass — "mbbs", "clinical", "medical" appear in the medical
    // subspaces' descriptions though none of the marker phrases appear verbatim.
    expect(hasKeywordEvidence(mbbsText, nlpOf(mbbsText), allSubs)).toBe(true)
  })

  it('matches an MBBS chat to the Medical Education App (not Tea, not null)', () => {
    // Medical clearly on-topic; Tea is off-topic and has no lexical evidence.
    const s = sem(
      { 2: 0.72, 3: 0.5 },
      { 20: 0.7, 21: 0.66, 22: 0.64, 30: 0.5, 31: 0.48 },
    )
    const result = findBestMatch(mbbsText, nlpOf(mbbsText), allSubs, s)

    expect(result).not.toBeNull()
    expect(result!.subspace.spaceId).toBe(2) // Medical Education App
    expect(result!.subspace.id).toBe(20) // Core Curriculum, given "mbbs curriculum"
  })
})

describe('findBestMatch — the steeping→Varieties tiebreak regression', () => {
  it('sends a steeping-time page to Brewing, not Varieties, despite variety name-drops', () => {
    const text =
      'Steeping time guide: the ideal water temperature and steeping duration for various tea ' +
      'varieties. Darjeeling steeps three minutes; oolong four. Over-steeping makes tea bitter.'

    // Both subspaces have lexical evidence (brewing terms AND variety names).
    // Brewing scores higher semantically, so semantic must lead among the
    // evidenced set — the word "varieties" appearing must NOT flip the pick.
    const s = sem({ 3: 0.66 }, { 30: 0.66, 31: 0.6 })
    const result = findBestMatch(text, nlpOf(text), [brewingSub, varietiesSub], s)

    expect(result).not.toBeNull()
    expect(result!.subspace.id).toBe(30) // Brewing, not Varieties
  })
})

describe('findBestMatch — discriminating bunched sibling subspaces', () => {
  // The "DC Multiverse vs Kryptonian biology" case: six siblings inside an
  // 8-point semantic band. A higher-semantic sibling with no marker corroboration
  // must NOT beat the broadly-corroborated correct one, and a lone-marker sibling
  // must not hijack the pick. This is what makes the correction loop stick.
  const kryptonianBioSub = sub(
    40, 4, 'Kryptonian biology',
    "Superman's physiology, powers and weaknesses.",
    ['kryptonite', 'krypton', 'radiation'],
  )
  const multiverseSub = sub(
    41, 4, 'DC Multiverse crossovers',
    'Crossover events across the multiverse and alternate realities.',
    ['reality shift', 'dimension hop'],
  )
  const mediaSub = sub(
    42, 4, 'Media adaptations',
    'Film and television adaptations analysis.',
    ['adaptations'],
  )

  it('picks the broadly-corroborated subspace over a higher-semantic bare one', () => {
    const text =
      'Kryptonite is the radioactive mineral from the planet Krypton. Green kryptonite emits ' +
      'radiation that weakens Superman. Across the multiverse, variant forms appear in various ' +
      'media adaptations.'

    // Multiverse (41) has the HIGHEST semantic (0.67) but no marker hits;
    // Media (42) has a single marker that hits; Kryptonian biology (40) is lower
    // semantic (0.63) but has three markers hitting → it must win.
    const s = sem({ 4: 0.7 }, { 40: 0.63, 41: 0.67, 42: 0.59 })
    const result = findBestMatch(
      text, nlpOf(text), [kryptonianBioSub, multiverseSub, mediaSub], s,
    )

    expect(result).not.toBeNull()
    expect(result!.subspace.id).toBe(40) // Kryptonian biology
  })
})

describe('findBestMatch — the semantic floor holds for unrelated pages', () => {
  const cText =
    'Interactive C tutorial. Learn C programming: pointers, functions, loops, arrays, and ' +
    'memory management. Compile and run your first C program.'
  const allSubs = [
    kryptoniteSub, loisSub, curriculumSub, examSub, clinicalSub, brewingSub, varietiesSub,
  ]

  it('finds no keyword evidence for a truly unrelated page (fluff words excluded)', () => {
    // "management" appears but is a generic-fluff stopword, so it is not evidence.
    expect(hasKeywordEvidence(cText, nlpOf(cText), allSubs)).toBe(false)
  })

  it('returns no match when the best space is below the semantic floor', () => {
    const s = sem(
      { 1: 0.5, 2: 0.52, 3: 0.48 },
      { 10: 0.5, 11: 0.5, 20: 0.52, 21: 0.5, 22: 0.5, 30: 0.48, 31: 0.48 },
    )
    expect(findBestMatch(cText, nlpOf(cText), allSubs, s)).toBeNull()
  })
})

describe('findBestMatch — basic guards', () => {
  it('returns null for an empty subspace list', () => {
    expect(findBestMatch('hello world', nlpOf('hello world'), [])).toBeNull()
  })

  it('leaves an ambiguous page (two spaces within the margin) unmatched', () => {
    const text = 'kryptonite and mbbs curriculum appear together ambiguously'
    // Two spaces score above the floor but within SPACE_MARGIN of each other.
    const s = sem({ 1: 0.66, 2: 0.63 }, { 10: 0.66, 11: 0.6, 20: 0.63, 21: 0.6 })
    const result = findBestMatch(
      text, nlpOf(text),
      [kryptoniteSub, loisSub, curriculumSub, examSub], s,
    )
    expect(result).toBeNull()
  })
})
