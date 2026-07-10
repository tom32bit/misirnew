/**
 * Kimi (Moonshot) conversation extractor
 *
 * Kimi is a Vue SPA with scoped, hashed class names. The conversation lives in
 * `.chat-detail-content`; each turn is a `.chat-content-item` whose role is on
 * the element itself (`.chat-content-item-user` / `.chat-content-item-assistant`)
 * and whose rendered text sits in one or more `.segment-content` blocks.
 */

import { BaseExtractor } from './base'
import type { ChatMessage, PlatformType } from '@/lib/types'

export class KimiExtractor extends BaseExtractor {
  readonly platform: PlatformType = 'kimi'
  readonly urlPatterns = [/^https:\/\/www\.kimi\.com\//i]
  readonly messageSelectors = ['.chat-content-item']

  getConversationId(url: string): string | null {
    const match = url.match(/\/chat\/([a-zA-Z0-9_-]+)/i)
    return match?.[1] ?? null
  }

  extractFromDOM(): ChatMessage[] {
    const items = this.sortByDOMOrder(
      Array.from(document.querySelectorAll('.chat-content-item')),
    )

    const messages: ChatMessage[] = []
    for (const el of items) {
      const cls = el.className.toLowerCase()
      const role: 'user' | 'assistant' = cls.includes('assistant')
        ? 'assistant'
        : cls.includes('user')
          ? 'user'
          : messages.length % 2 === 0
            ? 'user'
            : 'assistant'

      // Prefer the rendered segment text; a turn can hold several segments
      // (e.g. reasoning + answer), so join them. Fall back to the item's text.
      const segments = Array.from(el.querySelectorAll('.segment-content'))
      const content = (
        segments.length
          ? segments.map((s) => s.textContent?.trim() || '').filter(Boolean).join('\n')
          : el.textContent?.trim() || ''
      ).trim()

      if (content.length < 2) continue
      messages.push({ role, content })
    }

    // Fallback: if Kimi changes its per-turn markup, still capture the whole
    // conversation body as a single block so matching has something to work with.
    if (messages.length === 0) {
      const root = document.querySelector('.chat-detail-content')
      const text = root?.textContent?.trim()
      if (text && text.length > 20) messages.push({ role: 'user', content: text })
    }

    return this.deduplicateMessages(messages)
  }

  private deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
    const seen = new Set<string>()
    return messages.filter((msg) => {
      const key = `${msg.role}:${msg.content.slice(0, 100)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

export const kimiExtractor = new KimiExtractor()
