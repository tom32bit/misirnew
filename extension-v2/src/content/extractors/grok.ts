/**
 * Grok (X/Twitter) conversation extractor
 */

import { BaseExtractor } from './base'
import type { ChatMessage, PlatformType } from '@/lib/types'

export class GrokExtractor extends BaseExtractor {
  readonly platform: PlatformType = 'grok'
  readonly urlPatterns = [/^https:\/\/grok\.com\//i]
  readonly messageSelectors = [
    '.message',
    '.chat-message',
    '[data-testid*="message"]',
    '.conversation-turn',
  ]

  getConversationId(url: string): string | null {
    const match = url.match(/\/conversation\/([a-zA-Z0-9_-]+)/i)
    return match?.[1] ?? null
  }

  extractFromDOM(): ChatMessage[] {
    const messages: ChatMessage[] = []

    const messageElements = this.sortByDOMOrder(
      Array.from(document.querySelectorAll(this.messageSelectors.join(', ')))
    )

    for (const el of messageElements) {
      const content = this.getTextContent(el)
      if (!content || content.length < 5) continue

      const isUser = el.classList.contains('user-message') ||
        el.querySelector('[data-sender="user"]') !== null

      const isAssistant = el.classList.contains('assistant-message') ||
        el.classList.contains('grok-message') ||
        el.querySelector('[data-sender="assistant"]') !== null

      let role: 'user' | 'assistant'
      if (isUser) role = 'user'
      else if (isAssistant) role = 'assistant'
      else role = messages.length % 2 === 0 ? 'user' : 'assistant'

      messages.push({ role, content })
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

export const grokExtractor = new GrokExtractor()