/**
 * Gemini conversation extractor
 */

import { BaseExtractor } from './base'
import type { ChatMessage, PlatformType } from '@/lib/types'

export class GeminiExtractor extends BaseExtractor {
  readonly platform: PlatformType = 'gemini'
  readonly urlPatterns = [/^https:\/\/gemini\.google\.com\/app/i]
  readonly messageSelectors = [
    'model-response',
    '.model-response',
    '.user-query-content',
    '.user-query-container',
    '[data-turn-index]',
    '.conversation-turn',
  ]

  getConversationId(url: string): string | null {
    const match = url.match(/\/app\/([a-f0-9]+)/i)
    return match?.[1] ?? null
  }

  extractFromDOM(): ChatMessage[] {
    const messages: ChatMessage[] = []

    // Collect user and assistant containers with their DOM positions
    const items: { el: Element; role: 'user' | 'assistant' }[] = []

    // User queries
    document.querySelectorAll('.user-query-content, .user-query-container, .user-query').forEach((el) => {
      items.push({ el, role: 'user' })
    })

    // Model responses
    document.querySelectorAll('model-response, .model-response, .model-response-text').forEach((el) => {
      items.push({ el, role: 'assistant' })
    })

    // Sort by DOM position
    items.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el)
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1
      return 0
    })

    for (const { el, role } of items) {
      const content = this.getTextContent(el)
      if (content && content.length > 5) {
        messages.push({ role, content })
      }
    }

    // Fallback: positional alternation
    if (messages.length === 0) {
      document.querySelectorAll('.conversation-turn, [data-turn-index]').forEach((turn, i) => {
        const content = turn.textContent?.trim()
        if (content) {
          messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content })
        }
      })
    }

    return this.deduplicateMessages(messages)
  }

  private deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
    const seen = new Set<string>()
    return messages.filter(msg => {
      const key = `${msg.role}:${msg.content.slice(0, 100)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

export const geminiExtractor = new GeminiExtractor()