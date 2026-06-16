import type { ChatAdapter } from './types'
import type { ChatCapture, ChatMessage } from '@/types/chat'

// GET /api/v0/chat/history_messages?chat_session_id={id}&cache_version=0
// Auth: Bearer token from localStorage "userToken" (content scripts share localStorage with the page)
// Messages: follow parent_id chain from current_message_id backwards, then reverse
// Roles: "USER" → user, "ASSISTANT" → assistant

interface DSMessage {
  message_id: string
  parent_id: string | null
  role: string
  content: string
  status?: string
  thinking_content?: string
}

// Detector for when assistant has finished responding
function isAssistantDone(messages: DSMessage[]): boolean {
  if (messages.length < 2) return false // Need at least user + assistant
  
  const lastMsg = messages[messages.length - 1]
  // Assistant is done if last message is assistant and either finished or has content
  return lastMsg.role === 'ASSISTANT' && (lastMsg.status === 'FINISHED' || (lastMsg.content?.length ?? 0) > 0)
}

export const deepseekAdapter: ChatAdapter = {
  platform: 'deepseek',
  needsInjectWeb: false,
  triggerSelector: '[class*="message"], [data-message-id]',

  matches: (url) => url.includes('chat.deepseek.com'),

  getConversationId: (url) => {
    const m = url.match(/\/(?:a\/)?chat\/s\/([a-f0-9-]+)/i)
    if (m) return m[1]
    const q = url.match(/[?&]chat_session_id=([^&]+)/)
    return q?.[1] ?? null
  },

  async fetchConversation(conversationId): Promise<ChatCapture | null> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      try {
        const stored = localStorage.getItem('userToken')
        const token = stored ? (JSON.parse(stored) as { value?: string })?.value : null
        if (token) headers['Authorization'] = `Bearer ${token}`
      } catch {}

      const res = await fetch(
        `https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=${conversationId}&cache_version=0`,
        { credentials: 'include', headers },
      )
      if (!res.ok) return null
      const data = await res.json()

      const raw: DSMessage[] = data?.data?.biz_data?.chat_messages ?? []
      const session = data?.data?.biz_data?.chat_session
      const currentId: string | undefined = session?.current_message_id

      if (raw.length === 0) return null

      // Walk parent_id chain from current_message_id to reconstruct active branch
      const byId = new Map(raw.map((m) => [m.message_id, m]))
      const chain: DSMessage[] = []
      let cursor: string | null = currentId ?? null
      while (cursor) {
        const msg = byId.get(cursor)
        if (!msg) break
        chain.push(msg)
        cursor = msg.parent_id
      }
      chain.reverse()

      const messages: ChatMessage[] = chain
        .filter((m) => {
          // Accept finished messages, or ones without status, or ones still generating
          if (!m.status) return true
          if (m.status === 'FINISHED') return true
          // Also capture in-progress messages (partially generated)
          return !['CANCELLED', 'FAILED', 'DELETED'].includes(m.status)
        })
        .map((m) => ({
          role: (m.role === 'USER' || m.role === 'user') ? 'user' : 'assistant' as const,
          content: m.content?.trim() ?? '',
        }))
        .filter((m) => m.content.length > 0)

      if (messages.length === 0) return null

      return {
        platform: 'deepseek',
        conversationId,
        title: session?.title || messages[0]?.content.slice(0, 80) || 'DeepSeek chat',
        url: location.href,
        messages,
        capturedAt: new Date(),
      }
    } catch {
      return null
    }
  },
}
