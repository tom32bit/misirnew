/**
 * Perplexity conversation extractor
 */

import { BaseExtractor } from './base'
import type { ChatMessage, PlatformType } from '@/lib/types'

export class PerplexityExtractor extends BaseExtractor {
  readonly platform: PlatformType = 'perplexity'
  readonly urlPatterns = [/^https:\/\/www\.perplexity\.ai\//i]
  readonly messageSelectors = [
    '.prose',
    '.message-content',
    '[data-testid*="message"]',
    '.thread-message',
  ]

  getConversationId(url: string): string | null {
    // Perplexity uses thread IDs in URL
    const match = url.match(/\/thread\/([a-zA-Z0-9_-]+)/i)
    return match?.[1] ?? null
  }

  extractFromDOM(): ChatMessage[] {
    const messages: ChatMessage[] = []

    // Perplexity shows a thread with user questions and AI answers
    const threads = this.sortByDOMOrder(
      Array.from(document.querySelectorAll(this.messageSelectors.join(', ')))
    )

    let isUserTurn = true
    for (const thread of threads) {
      const content = this.getTextContent(thread)
      if (content && content.length > 10) {
        messages.push({ role: isUserTurn ? 'user' : 'assistant', content })
        isUserTurn = !isUserTurn
      }
    }

    // Fallback: look for question/answer pairs
    if (messages.length === 0) {
      const questions = document.querySelectorAll('.question, [data-testid="question"]')
      const answers = document.querySelectorAll('.answer, [data-testid="answer"]')

      const minLen = Math.min(questions.length, answers.length)
      for (let i = 0; i < minLen; i++) {
        const q = questions[i]?.textContent?.trim()
        const a = answers[i]?.textContent?.trim()
        if (q) messages.push({ role: 'user', content: q })
        if (a) messages.push({ role: 'assistant', content: a })
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

export const perplexityExtractor = new PerplexityExtractor()