import type { ChatAdapter } from './types'
import type { ChatCapture, ChatMessage } from '@/types/chat'

// GET https://copilot.microsoft.com/c/api/conversations/{id}/history?api-version=2
// Auth: Bearer token from localStorage (auth0 key pattern)
// Results are newest-first → reverse to chronological order
// author.type: "human" → user, else → assistant

interface CopilotContent { type: string; text?: string }
interface CopilotResult {
  id: string
  author: { type: string }
  content: CopilotContent[]
  createdAt?: string
}

function getCopilotToken(): string | null {
  const isAuth0Key = (k: string) =>
    k.includes('@@auth0spajs@@') &&
    k.includes('copilot.microsoft.com::openid') &&
    k.includes('offline_access')

  for (const store of [localStorage, sessionStorage]) {
    try {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i)
        if (!key || !isAuth0Key(key)) continue
        const raw = store.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw) as { body?: { access_token?: string; token_type?: string } }
        const token = parsed?.body?.access_token
        const type = parsed?.body?.token_type ?? 'Bearer'
        if (token) return `${type} ${token}`
      }
    } catch {}
  }
  return null
}

export const copilotAdapter: ChatAdapter = {
  platform: 'copilot',
  needsInjectWeb: false,
  triggerSelector: 'cib-chat-main, [data-testid="chat-container"], main',

  matches: (url) => url.includes('copilot.microsoft.com'),

  getConversationId: (url) => {
    const m = url.match(/\/chats?\/([^/?#]+)/)
    return m?.[1] ?? (url.includes('copilot.microsoft.com') ? 'default' : null)
  },

  async fetchConversation(conversationId): Promise<ChatCapture | null> {
    if (conversationId === 'default') return null

    try {
      const headers: Record<string, string> = { Accept: '*/*', 'Content-Type': 'application/json' }
      const token = getCopilotToken()
      if (token) headers['Authorization'] = token

      const res = await fetch(
        `https://copilot.microsoft.com/c/api/conversations/${conversationId}/history?api-version=2`,
        { credentials: 'include', headers },
      )
      if (!res.ok) return null
      const data = await res.json()

      const results: CopilotResult[] = [...(data.results as CopilotResult[] ?? [])].reverse()

      const messages: ChatMessage[] = results
        .map((r) => {
          const role = r.author.type === 'human' ? 'user' : 'assistant' as const
          const content = (r.content ?? [])
            .filter((c) => c.type === 'text' && c.text?.trim())
            .map((c) => c.text!)
            .join('\n\n')
            .trim()
          return { role, content, createdAt: r.createdAt ? new Date(r.createdAt) : undefined }
        })
        .filter((m) => m.content.length > 0)

      if (messages.length === 0) return null

      const firstUser = messages.find((m) => m.role === 'user')
      return {
        platform: 'copilot',
        conversationId,
        title: firstUser?.content.slice(0, 80) ?? 'Copilot chat',
        url: location.href,
        messages,
        capturedAt: new Date(),
      }
    } catch {
      return null
    }
  },
}
