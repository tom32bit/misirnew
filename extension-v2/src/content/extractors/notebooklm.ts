/**
 * NotebookLM conversation extractor
 */

import { BaseExtractor } from './base'
import type { ChatMessage, PlatformType } from '@/lib/types'

export class NotebookLMExtractor extends BaseExtractor {
  readonly platform: PlatformType = 'notebooklm'
  readonly urlPatterns = [/^https:\/\/notebooklm\.google\.com\//i]
  readonly messageSelectors = [
    '.source-text',
    '.model-response',
    '.chat-message',
    '[data-message-type]',
    '.conversation-turn',
  ]

  getConversationId(url: string): string | null {
    const match = url.match(/\/notebook\/([a-zA-Z0-9_-]+)/i)
    return match?.[1] ?? null
  }

  extractFromDOM(): ChatMessage[] {
    const messages: ChatMessage[] = []

    // NotebookLM has sources and model responses
    const sourceElements = document.querySelectorAll('.source-text, [data-source-id]')
    const responseElements = document.querySelectorAll('.model-response, [data-response-id]')

    // Interleave sources and responses by DOM position
    const allElements: { el: Element; type: 'source' | 'response' }[] = []

    sourceElements.forEach(el => allElements.push({ el, type: 'source' }))
    responseElements.forEach(el => allElements.push({ el, type: 'response' }))

    allElements.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el)
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1
      return 0
    })

    for (const { el, type } of allElements) {
      const content = this.getTextContent(el)
      if (!content || content.length < 10) continue

      messages.push({
        role: type === 'source' ? 'user' : 'assistant',
        content,
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

export const notebooklmExtractor = new NotebookLMExtractor()