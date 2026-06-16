import { Readability } from '@mozilla/readability'

export interface PageContent {
  title: string
  textContent: string
  excerpt: string | null
  wordCount: number
  url: string
  normalizedUrl: string
  domain: string
  contentHash: string
}

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'mc_cid', 'mc_eid', 'twclid', 'igshid',
]

export function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    TRACKING_PARAMS.forEach((p) => u.searchParams.delete(p))
    u.hash = ''
    return u.toString()
  } catch {
    return rawUrl
  }
}

export function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname
  } catch {
    return ''
  }
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function extractPageContent(
  doc: Document,
  rawUrl: string,
): Promise<PageContent | null> {
  // DOMParser produces a clean document without custom-element registry bindings,
  // avoiding the __CE_registry null-access crash that cloneNode(true) causes on
  // pages like Wikipedia that use custom elements.
  const clean = new DOMParser().parseFromString(doc.documentElement.outerHTML, 'text/html')
  const article = new Readability(clean).parse()

  if (!article?.textContent?.trim()) return null

  const textContent = article.textContent.trim()

  const [contentHash] = await Promise.all([sha256(textContent)])

  return {
    title: article.title || doc.title,
    textContent,
    excerpt: article.excerpt ?? null,
    wordCount: textContent.split(/\s+/).filter(Boolean).length,
    url: rawUrl,
    normalizedUrl: normalizeUrl(rawUrl),
    domain: extractDomain(rawUrl),
    contentHash,
  }
}
