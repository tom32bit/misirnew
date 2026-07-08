/**
 * Web page capture using Mozilla Readability
 * Ported from old extension, simplified
 */

import { Readability } from '@mozilla/readability'
import { normalizeUrl, extractDomain, sha256 } from '@/lib/utils'
import { redactPII } from '@/lib/redact'
import type { PageContent } from '@/lib/types'

export async function extractPageContent(
  doc: Document,
  rawUrl: string
): Promise<PageContent | null> {
  // DOMParser produces a clean document without custom-element registry bindings,
  // avoiding the __CE_registry null-access crash that cloneNode(true) causes on
  // pages like Wikipedia that use custom elements.
  const clean = new DOMParser().parseFromString(doc.documentElement.outerHTML, 'text/html')
  const article = new Readability(clean).parse()

  if (!article?.textContent?.trim()) return null

  const textContent = article.textContent.trim()
  const [contentHash] = await Promise.all([sha256(textContent)])

  // Redact PII before returning
  const redactedTitle = redactPII(article.title || doc.title)
  const redactedText = redactPII(textContent)

  return {
    title: redactedTitle,
    textContent: redactedText,
    excerpt: article.excerpt ?? null,
    wordCount: textContent.split(/\s+/).filter(Boolean).length,
    url: rawUrl,
    normalizedUrl: normalizeUrl(rawUrl),
    domain: extractDomain(rawUrl),
    contentHash,
  }
}

/**
 * Check if current page is an AI chat platform (should use chat extractor instead)
 */
import { isAIChatPlatform } from './platform-detector'

export function shouldUseWebCapture(url: string): boolean {
  return !isAIChatPlatform(url)
}