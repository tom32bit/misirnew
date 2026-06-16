import { describe, it, expect } from 'vitest'
import { normalizeUrl, extractDomain } from './capture'

describe('normalizeUrl', () => {
  it('strips utm_source', () => {
    expect(normalizeUrl('https://example.com/page?utm_source=google')).toBe(
      'https://example.com/page',
    )
  })

  it('strips multiple tracking params while preserving non-tracking ones', () => {
    const url = 'https://example.com/page?id=42&utm_campaign=summer&utm_medium=email'
    expect(normalizeUrl(url)).toBe('https://example.com/page?id=42')
  })

  it('strips all supported tracking params', () => {
    const params = [
      'utm_source=a', 'utm_medium=b', 'utm_campaign=c', 'utm_term=d', 'utm_content=e',
      'fbclid=f', 'gclid=g', 'ref=h', 'mc_cid=i', 'mc_eid=j', 'twclid=k', 'igshid=l',
    ].join('&')
    expect(normalizeUrl(`https://example.com/?${params}`)).toBe('https://example.com/')
  })

  it('removes the URL hash', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe(
      'https://example.com/page',
    )
  })

  it('removes both tracking params and hash', () => {
    expect(normalizeUrl('https://example.com/page?utm_source=x#top')).toBe(
      'https://example.com/page',
    )
  })

  it('leaves a clean URL unchanged', () => {
    expect(normalizeUrl('https://example.com/article?id=99')).toBe(
      'https://example.com/article?id=99',
    )
  })

  it('returns the raw string unchanged when it is not a valid URL', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url')
  })
})

describe('extractDomain', () => {
  it('returns the hostname for a standard URL', () => {
    expect(extractDomain('https://www.example.com/page')).toBe('www.example.com')
  })

  it('returns just the hostname without port', () => {
    expect(extractDomain('https://example.com:8080/page')).toBe('example.com')
  })

  it('returns an empty string for an invalid URL', () => {
    expect(extractDomain('not-a-url')).toBe('')
  })
})
