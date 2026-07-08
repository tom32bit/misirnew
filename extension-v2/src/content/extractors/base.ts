/**
 * Base conversation extractor class
 * All platform-specific extractors extend this
 */

import type {
  ConversationExtractor,
  ConversationData,
  ChatMessage,
  PlatformType,
} from '@/lib/types'

export abstract class BaseExtractor implements ConversationExtractor {
  abstract readonly platform: PlatformType
  abstract readonly urlPatterns: RegExp[]
  abstract readonly messageSelectors: string[]

  matches(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url))
  }

  abstract getConversationId(url: string): string | null

  abstract extractFromDOM(): ChatMessage[]

  getTitle(messages: ChatMessage[]): string {
    const firstUser = messages.find(m => m.role === 'user')
    if (firstUser) {
      return firstUser.content.slice(0, 80) + (firstUser.content.length > 80 ? '...' : '')
    }
    return `${this.platform.charAt(0).toUpperCase() + this.platform.slice(1)} chat`
  }

  buildConversationData(messages: ChatMessage[], conversationId: string, url: string): ConversationData {
    return {
      messages,
      title: this.getTitle(messages),
      conversationId,
      platform: this.platform,
      url,
      capturedAt: new Date(),
    }
  }

  /**
   * Helper to extract text content from an element, handling various structures
   */
  protected getTextContent(el: Element): string {
    // Try to get text from specific content elements first
    const contentEl = el.querySelector('[data-message-content], .message-content, .prose, .markdown, [data-testid*="content"]')
    if (contentEl) {
      return contentEl.textContent?.trim() || ''
    }
    return el.textContent?.trim() || ''
  }

  /**
   * Helper to determine role from element
   */
  protected getRoleFromElement(el: Element, platform: PlatformType): 'user' | 'assistant' {
    const className = el.className.toLowerCase()
    const role = el.getAttribute('data-message-author-role')?.toLowerCase()

    // Platform-specific role detection
    if (platform === 'chatgpt') {
      if (role === 'user') return 'user'
      if (role === 'assistant') return 'assistant'
    }

    // Generic fallbacks
    if (className.includes('user') || className.includes('human') || className.includes('query')) return 'user'
    if (className.includes('assistant') || className.includes('model') || className.includes('bot') || className.includes('ai')) return 'assistant'

    // Default: alternate based on position (will be sorted by DOM order)
    return 'user'
  }

  /**
   * Sort elements by DOM position (top to bottom)
   */
  protected sortByDOMOrder<T extends Element>(elements: T[]): T[] {
    return elements.sort((a, b) => {
      const pos = a.compareDocumentPosition(b)
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1
      return 0
    })
  }
}