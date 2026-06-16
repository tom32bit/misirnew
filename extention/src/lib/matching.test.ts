import { describe, it, expect } from 'vitest'
import { findBestMatch } from './matching'
import type { SubspaceWithMarkers, Marker } from '@/types'
import type { NLPResult } from './nlp'

function makeSubspace(
  id: number,
  markerDefs: { id: number; label: string }[],
): SubspaceWithMarkers {
  return {
    id,
    spaceId: 1,
    userId: 'u1',
    name: `sub-${id}`,
    artifactCount: 0,
    confidence: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    markers: markerDefs.map((m): Marker => ({
      id: m.id,
      spaceId: 1,
      userId: 'u1',
      label: m.label,
      weight: 1,
      createdAt: new Date(),
    })),
  }
}

const nlp = (keywords: string[], entities: string[] = []): NLPResult => ({ keywords, entities })

describe('findBestMatch', () => {
  it('returns null for an empty subspace list', () => {
    expect(findBestMatch('hello world', nlp(['hello', 'world']), [])).toBeNull()
  })

  it('returns null when stage 1 fails — no marker label found in text', () => {
    const sub = makeSubspace(1, [{ id: 1, label: 'machine learning' }])
    expect(findBestMatch('the cat sat on the mat', nlp(['cat', 'sat', 'mat']), [sub])).toBeNull()
  })

  it('returns null when stage 2 score is below 0.15', () => {
    // stage 1 passes: "machine learning" is literally in the text
    // stage 2 fails: NLP keywords share no terms with marker tokens
    const sub = makeSubspace(1, [{ id: 1, label: 'machine learning' }])
    const text = 'machine learning appears briefly here, mostly about cats and dogs'
    expect(findBestMatch(text, nlp(['cat', 'dog', 'appear']), [sub])).toBeNull()
  })

  it('returns a match when both stages pass', () => {
    const sub = makeSubspace(1, [{ id: 1, label: 'transformer model' }])
    const text = 'this paper introduces a new transformer model for NLP'
    const result = findBestMatch(text, nlp(['transformer', 'model', 'paper']), [sub])

    expect(result).not.toBeNull()
    expect(result!.subspace.id).toBe(1)
    expect(result!.matchedMarkerIds).toContain(1)
    expect(result!.confidence).toBeGreaterThanOrEqual(0.15)
    expect(result!.stageMatchedAt).toBe(2)
  })

  it('returns the subspace with the higher stage 2 score when multiple match', () => {
    // lowSub: one of its markers ("unseen term") is not in page terms, diluting the score
    const lowSub = makeSubspace(1, [
      { id: 1, label: 'transformer model' },
      { id: 2, label: 'unseen term' },
    ])
    // highSub: all marker tokens appear in page terms → score = 1.0
    const highSub = makeSubspace(2, [
      { id: 3, label: 'transformer' },
      { id: 4, label: 'neural network' },
    ])

    const text = 'transformer model neural network'
    const keywords = ['transformer', 'model', 'neural', 'network']
    const result = findBestMatch(text, nlp(keywords), [lowSub, highSub])

    expect(result).not.toBeNull()
    expect(result!.subspace.id).toBe(2)
  })

  it('skips subspaces with no markers', () => {
    const sub = makeSubspace(1, [])
    expect(findBestMatch('any text', nlp(['any', 'text']), [sub])).toBeNull()
  })

  it('includes only stage-1 matched marker ids in the result', () => {
    const sub = makeSubspace(1, [
      { id: 10, label: 'neural network' },
      { id: 11, label: 'deep learning' },
      { id: 12, label: 'database' }, // not in text
    ])
    const text = 'neural network and deep learning techniques'
    const result = findBestMatch(text, nlp(['neural', 'network', 'deep', 'learning']), [sub])

    expect(result).not.toBeNull()
    expect(result!.matchedMarkerIds).toContain(10)
    expect(result!.matchedMarkerIds).toContain(11)
    expect(result!.matchedMarkerIds).not.toContain(12)
  })

  it('is case-insensitive in stage 1', () => {
    const sub = makeSubspace(1, [{ id: 1, label: 'Machine Learning' }])
    const text = 'An overview of machine learning methods'
    const result = findBestMatch(text, nlp(['machine', 'learning', 'method', 'overview']), [sub])

    expect(result).not.toBeNull()
    expect(result!.matchedMarkerIds).toContain(1)
  })

  it('uses entities from nlpResult in stage 2 overlap', () => {
    const sub = makeSubspace(1, [{ id: 1, label: 'openai gpt' }])
    const text = 'openai gpt is a large language model from OpenAI'
    // entities carries "OpenAI" lowercased, keywords carry "large", "language", "model"
    const result = findBestMatch(
      text,
      nlp(['large', 'language', 'model'], ['openai']),
      [sub],
    )

    expect(result).not.toBeNull()
    expect(result!.matchedMarkerIds).toContain(1)
  })
})
