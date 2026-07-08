/**
 * Claude conversation extractor
 */

import { BaseExtractor } from './base'
import type { ChatMessage, PlatformType } from '@/lib/types'

export class ClaudeExtractor extends BaseExtractor {
  readonly platform: PlatformType = 'claude'
  readonly urlPatterns = [
    /^https:\/\/claude\.ai\/chat\/[a-f0-9-]{36}/i,
    /^https:\/\/claude\.ai\/project\/[^/]+\/chat\/[a-f0-9-]{36}/i,
  ]
  readonly messageSelectors = [
    '[data-testid="conversation-turn"]',
    '.conversation-turn',
    '[data-testid*="message"]',
  ]

  getConversationId(url: string): string | null {
    // Handle both /chat/ and /project/.../chat/ URLs
    const match = url.match(/\/chat\/([a-f0-9-]{36})/i)
    return match?.[1] ?? null
  }

  extractFromDOM(): ChatMessage[] {
    const messages: ChatMessage[] = []

    // Find all conversation turns
    const turns = this.sortByDOMOrder(
      Array.from(document.querySelectorAll(this.messageSelectors.join(', ')))
    )

    for (const turn of turns) {
      // Each turn has user and assistant messages
      const userMsg = turn.querySelector('[data-testid="user-message"], .user-message, [data-sender="human"]')
      const assistantMsg = turn.querySelector('[data-testid="assistant-message"], .assistant-message, [data-sender="assistant"]')

      if (userMsg) {
        const content = this.getTextContent(userMsg)
        if (content) messages.push({ role: 'user', content })
      }

      if (assistantMsg) {
        const content = this.getTextContent(assistantMsg)
        if (content) messages.push({ role: 'assistant', content })
      }
    }

    // Fallback: if no turns found, try to find all message elements
    if (messages.length === 0) {
      const allMessages = this.sortByDOMOrder(
        Array.from(document.querySelectorAll('[data-testid*="message"], .message, [data-sender]'))
      )

      for (const msg of allMessages) {
        const sender = msg.getAttribute('data-sender')?.toLowerCase()
        const role = sender === 'human' ? 'user' : sender === 'assistant' ? 'assistant' : 'user'
        const content = this.getTextContent(msg)
        if (content) messages.push({ role, content })
      }
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

export const claudeExtractor = new ClaudeExtractor()