import type { ChatAdapter } from './types'
import type { ChatCapture, ChatMessage } from '@/types/chat'

// Two-step API (no auth header needed — session cookies sufficient):
// 1. GET /rest/app-chat/conversations/{id}/response-node?includeThreads=true  → responseNodes[].responseId
// 2. POST /rest/app-chat/conversations/{id}/load-responses  { responseIds: [...] } → responses[]
// sender: "human" → user, anything else → assistant

interface GrokResponseNode { responseId: string }
interface GrokResponse {
  responseId: string
  sender: string
  message: string
  createTime: string
  partial?: boolean
}

export const grokAdapter: ChatAdapter = {
  platform: 'grok',
  needsInjectWeb: false,
  triggerSelector: '[class*="message"], [data-message-id]',

  matches: (url) => url.includes('grok.com'),

  getConversationId: (url) => {
    const m = url.match(/\/c\/([a-f0-9-]+)/i)
    return m?.[1] ?? null
  },

  async fetchConversation(conversationId): Promise<ChatCapture | null> {
    try {
      const nodesRes = await fetch(
        `https://grok.com/rest/app-chat/conversations/${conversationId}/response-node?includeThreads=true`,
        { credentials: 'include', headers: { Accept: '*/*', 'Content-Type': 'application/json' } },
      )
      if (!nodesRes.ok) return null
      const nodesData = await nodesRes.json()

      const responseIds: string[] = (nodesData.responseNodes as GrokResponseNode[] ?? [])
        .map((n) => n.responseId)
      if (responseIds.length === 0) return null

      const loadRes = await fetch(
        `https://grok.com/rest/app-chat/conversations/${conversationId}/load-responses`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: '*/*', 'Content-Type': 'application/json' },
          body: JSON.stringify({ responseIds }),
        },
      )
      if (!loadRes.ok) return null
      const loadData = await loadRes.json()

      const responses: GrokResponse[] = [...(loadData.responses as GrokResponse[] ?? [])]
        .sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime())

      const messages: ChatMessage[] = responses
        .filter((r) => !r.partial)
        .map((r) => ({
          role: r.sender === 'human' ? 'user' : 'assistant' as const,
          content: r.message?.trim() ?? '',
          createdAt: r.createTime ? new Date(r.createTime) : undefined,
        }))
        .filter((m) => m.content.length > 0)

      if (messages.length === 0) return null

      const firstUser = messages.find((m) => m.role === 'user')
      return {
        platform: 'grok',
        conversationId,
        title: firstUser?.content.slice(0, 80) ?? 'Grok chat',
        url: location.href,
        messages,
        capturedAt: new Date(),
      }
    } catch {
      return null
    }
  },
}
