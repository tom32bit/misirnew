/**
 * Kimi (Moonshot) conversation extractor
 */

import { BaseExtractor } from './base'
import type { ChatMessage, PlatformType } from '@/lib/types'

export class KimiExtractor extends BaseExtractor {
  readonly platform: PlatformType = 'kimi'
  readonly urlPatterns = [/^https:\/\/www\.kimi\.com\//i]
  readonly messageSelectors = [
    '.chat-message',
    '.message-item',
    '[data-message-id]',
    '.conversation-content .message',
  ]

  getConversationId(url: string): string | null {
    const match = url.match(/\/chat\/([a-zA-Z0-9_-]+)/i)
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

      // Determine role from classes or structure
      const isUser = el.classList.contains('user') ||
        el.classList.contains('human') ||
        el.querySelector('.user-avatar, .human-avatar') !== null

      const isAssistant = el.classList.contains('assistant') ||
        el.classList.contains('ai') ||
        el.querySelector('.assistant-avatar, .ai-avatar') !== null

      let role: 'user' | 'assistant'
      if (isUser) role = 'user'
      else if (isAssistant) role = 'assistant'
      else {
        // Alternate as fallback
        role = messages.length % 2 === 0 ? 'user' : 'assistant'
      }

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

export const kimiExtractor = new KimiExtractor()