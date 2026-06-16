import type { ChatAdapter } from './types'
import type { ChatCapture, ChatMessage } from '@/types/chat'

// Gemini uses Google's proprietary batchexecute RPC format which is complex to replicate.
// We use DOM extraction as a reliable fallback. Selectors target the rendered message elements.

function extractMessagesFromDOM(): ChatMessage[] {
  // Collect user and assistant containers with their DOM positions, then sort
  // so the final array respects conversation order rather than grouping by role.
  const items: { el: Element; role: 'user' | 'assistant' }[] = []

  document.querySelectorAll('.user-query-content-with-footer, .user-query-container').forEach((el) => {
    items.push({ el, role: 'user' })
  })
  document.querySelectorAll('model-response').forEach((el) => {
    items.push({ el, role: 'assistant' })
  })

  items.sort((a, b) =>
    a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )

  const messages: ChatMessage[] = items
    .map(({ el, role }) => ({ role, content: el.textContent?.trim() ?? '' }))
    .filter((m) => m.content.length > 0)

  // Fallback: positional alternation when primary selectors find nothing
  if (messages.length === 0) {
    document.querySelectorAll('.conversation-turn, [data-turn-index]').forEach((turn, i) => {
      const content = turn.textContent?.trim()
      if (content) messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content })
    })
  }

  return messages
}

export const geminiAdapter: ChatAdapter = {
  platform: 'gemini',
  needsInjectWeb: false,
  triggerSelector: 'model-response, .model-response-text',

  matches: (url) => url.includes('gemini.google.com/app'),

  getConversationId: (url) => {
    const m = url.match(/\/app\/([a-f0-9]+)/i)
    return m?.[1] ?? null
  },

  async fetchConversation(conversationId): Promise<ChatCapture | null> {
    const messages = extractMessagesFromDOM()
    if (messages.length === 0) return null

    const firstUser = messages.find((m) => m.role === 'user')

    return {
      platform: 'gemini',
      conversationId,
      title: firstUser?.content.slice(0, 80) ?? 'Gemini chat',
      url: location.href,
      messages,
      capturedAt: new Date(),
    }
  },
}
