/**
 * ChatGPT conversation extractor
 * Uses DOM extraction since the private API requires auth tokens
 */

import { BaseExtractor } from './base'
import type { ChatMessage, PlatformType } from '@/lib/types'

export class ChatGPTExtractor extends BaseExtractor {
  readonly platform: PlatformType = 'chatgpt'
  readonly urlPatterns = [/^https:\/\/chatgpt\.com\/c\/[a-f0-9-]{36}/i]
  readonly messageSelectors = [
    '[data-message-author-role="user"]',
    '[data-message-author-role="assistant"]',
  ]

  getConversationId(url: string): string | null {
    const match = url.match(/\/c\/([a-f0-9-]{36})/i)
    return match?.[1] ?? null
  }

  extractFromDOM(): ChatMessage[] {
    const messages: ChatMessage[] = []

    // Get all message elements in DOM order
    const elements = this.sortByDOMOrder(
      Array.from(document.querySelectorAll(this.messageSelectors.join(', ')))
    )

    for (const el of elements) {
      const role = (el.getAttribute('data-message-author-role') as 'user' | 'assistant') || 'user'
      const content = this.extractMessageContent(el)

      if (content) {
        messages.push({ role, content })
      }
    }

    return this.deduplicateMessages(messages)
  }

  private extractMessageContent(el: Element): string {
    // Try multiple content selectors for ChatGPT
    const contentSelectors = [
      '.markdown',
      '.prose',
      '[data-message-content]',
      '.message-content',
      'div[class*="text-"]',
    ]

    for (const selector of contentSelectors) {
      const contentEl = el.querySelector(selector)
      if (contentEl?.textContent?.trim()) {
        return contentEl.textContent.trim()
      }
    }

    // Fallback: get all text from the message container
    const text = el.textContent?.trim()
    if (text && text.length > 10) { // Filter out tiny fragments
      return text
    }

    return ''
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

// Export singleton
export const chatgptExtractor = new ChatGPTExtractor()