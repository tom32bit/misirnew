import type { ChatAdapter } from './types'
import type { ChatCapture, ChatMessage } from '@/types/chat'

// GET /rest/thread/{threadId}?with_parent_info=true&with_schematized_response=true
// Auth: session cookies (credentials: 'include')
// Response: { entries: [{ uuid, query_str, blocks[], user_selected_model, thread_title }] }

interface PerplexityBlock {
  intended_usage?: string
  markdown_block?: { answer?: string }
  text?: string
}

interface PerplexityEntry {
  uuid: string
  query_str: string
  blocks: PerplexityBlock[]
  user_selected_model?: string
  thread_title?: string
  entry_updated_datetime?: string
}

export const perplexityAdapter: ChatAdapter = {
  platform: 'perplexity',
  needsInjectWeb: false,
  triggerSelector: '.md.prose',

  matches: (url) => url.includes('perplexity.ai/search/'),

  getConversationId: (url) => {
    const m = url.match(/\/search\/([^?#]+)/)
    return m?.[1] ?? null
  },

  async fetchConversation(conversationId): Promise<ChatCapture | null> {
    try {
      const res = await fetch(
        `https://www.perplexity.ai/rest/thread/${conversationId}?with_parent_info=true&with_schematized_response=true`,
        { credentials: 'include' },
      )
      if (!res.ok) return null
      const data = await res.json()

      const entries: PerplexityEntry[] = data.entries ?? []
      if (entries.length === 0) return null

      const messages: ChatMessage[] = []
      let lastModel: string | undefined

      for (const entry of entries) {
        if (entry.user_selected_model) lastModel = entry.user_selected_model

        if (entry.query_str) {
          messages.push({ role: 'user', content: entry.query_str.trim() })
        }

        const assistantText = entry.blocks
          .filter((b) => b.intended_usage === 'ask_text' || b.intended_usage?.startsWith('ask_text_'))
          .map((b) => b.markdown_block?.answer ?? b.text ?? '')
          .filter(Boolean)
          .join('\n')
          .trim()

        if (assistantText) {
          messages.push({ role: 'assistant', content: assistantText, model: lastModel })
        }
      }

      const title =
        entries[0]?.thread_title ||
        entries[0]?.query_str?.slice(0, 80) ||
        'Perplexity search'

      return {
        platform: 'perplexity',
        conversationId,
        title,
        url: `https://www.perplexity.ai/search/${conversationId}`,
        messages: messages.filter((m) => m.content.length > 0),
        capturedAt: new Date(),
      }
    } catch {
      return null
    }
  },
}
