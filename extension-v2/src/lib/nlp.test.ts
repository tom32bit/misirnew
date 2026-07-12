import { describe, it, expect } from 'vitest'
import { extractLearnableTerms } from './nlp'

// Guards the learned-marker quality filter. The regression it exists to stop:
// a Superman/Wikipedia-style page saved ~15 junk markers ("green", "first",
// "december 1949", "november", "minutes", "decades", "tomorrow"…) that then
// falsely matched unrelated pages. extractLearnableTerms POS/NER-gates those out.
describe('extractLearnableTerms', () => {
  const wikiText = `
    Kryptonite is a fictional material from the Superman stories. Green
    kryptonite first appeared in a story published in December 1949, and by
    November of the following year it was a staple of the comics. Exposure
    weakens Superman within minutes. Over the decades, writers introduced new
    varieties. The character lives in Metropolis and works at the Daily Planet.
    Perhaps tomorrow another writer will change the third act again.
  `

  const terms = extractLearnableTerms(wikiText)

  it('drops dates, ordinals, colours and generic words', () => {
    const junk = [
      'green', 'first', 'third', 'december 1949', 'november', 'december',
      'minutes', 'minute', 'decades', 'decade', 'tomorrow', 'fall', 'year',
    ]
    const leaked = junk.filter((j) => terms.includes(j))
    expect(leaked).toEqual([])
  })

  it('has no term containing a digit', () => {
    expect(terms.filter((t) => /\d/.test(t))).toEqual([])
  })

  it('keeps genuine topical nouns/entities', () => {
    // At least some real subject vocabulary should survive the filter.
    const topical = ['kryptonite', 'superman', 'metropolis', 'material', 'character', 'writer', 'story', 'comics', 'exposure', 'variety']
    expect(terms.some((t) => topical.includes(t))).toBe(true)
  })

  it('returns nothing for empty input', () => {
    expect(extractLearnableTerms('')).toEqual([])
  })
})
