import type { ChatAdapter } from './types'
import type { ChatCapture, ChatMessage } from '@/types/chat'

// DOM-based extraction — NotebookLM uses Angular Material components
// User queries: .user-query, [data-role="user"]
// Model answers: .response-container, [data-role="assistant"], .answer-container

function extractMessagesFromDOM(): ChatMessage[] {
  const items: { el: Element; role: 'user' | 'assistant' }[] = []

  document.querySelectorAll('.user-query, [data-role="user"], .question-container').forEach((el) => {
    items.push({ el, role: 'user' })
  })
  document.querySelectorAll('.response-container, [data-role="assistant"], .answer-container').forEach((el) => {
    items.push({ el, role: 'assistant' })
  })

  items.sort((a, b) =>
    a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )

  const messages: ChatMessage[] = items
    .map(({ el, role }) => ({ role, content: el.textContent?.trim() ?? '' }))
    .filter((m) => m.content.length > 0)

  // Fallback: positional alternation
  if (messages.length === 0) {
    document.querySelectorAll('[data-chat-turn], .chat-turn').forEach((turn, i) => {
      const content = turn.textContent?.trim()
      if (content) messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content })
    })
  }

  return messages
}

export const notebooklmAdapter: ChatAdapter = {
  platform: 'notebooklm',
  needsInjectWeb: false,
  triggerSelector: '.chat-container, .notebook-chat, main',

  matches: (url) => url.includes('notebooklm.google.com'),

  getConversationId: (url) => {
    const m = url.match(/\/notebook\/([^/?#]+)/)
    return m?.[1] ?? null
  },

  async fetchConversation(conversationId): Promise<ChatCapture | null> {
    const messages = extractMessagesFromDOM()
    if (messages.length === 0) return null

    const firstUser = messages.find((m) => m.role === 'user')

    return {
      platform: 'notebooklm',
      conversationId,
      title: firstUser?.content.slice(0, 80) ?? 'NotebookLM chat',
      url: location.href,
      messages,
      capturedAt: new Date(),
    }
  },
}
