import type { ChatAdapter } from './types'
import type { ChatCapture, ChatMessage } from '@/types/chat'

// GET /api/organizations/{orgId}/chat_conversations/{convId}?tree=True&rendering_mode=messages&render_all_tools=true
// Auth: session cookies (credentials: 'include'); org ID from lastActiveOrg cookie

function getOrgId(): string | null {
  try {
    const m = document.cookie.match(/lastActiveOrg=([^;]+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

export const claudeAdapter: ChatAdapter = {
  platform: 'claude',
  needsInjectWeb: false,
  triggerSelector: '[data-testid="conversation-turn"]',

  matches: (url) => url.includes('claude.ai/chat/') || url.includes('claude.ai/project/'),

  getConversationId: (url) => {
    const m = url.match(/\/chat\/([a-f0-9-]{36})/i) ?? url.match(/\/project\/[^/]+\/chat\/([a-f0-9-]{36})/i)
    return m?.[1] ?? null
  },

  async fetchConversation(conversationId): Promise<ChatCapture | null> {
    const orgId = getOrgId()
    if (!orgId) return null

    try {
      const res = await fetch(
        `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=True&rendering_mode=messages&render_all_tools=true`,
        {
          credentials: 'include',
          headers: { Accept: '*/*', 'Content-Type': 'application/json' },
        },
      )
      if (!res.ok) return null
      const data = await res.json()

      interface RawMessage {
        sender: string
        content: { type: string; text?: string }[]
        uuid: string
        index: number
        truncated?: boolean
        parent_message_uuid?: string
      }

      const raw: RawMessage[] = [...(data.chat_messages ?? [])].sort(
        (a: RawMessage, b: RawMessage) => a.index - b.index,
      )

      const messages: ChatMessage[] = []
      const parentSeen = new Map<string, number>()

      for (const m of raw) {
        if (m.truncated) continue
        if (m.sender !== 'human' && m.sender !== 'assistant') continue

        const content = m.content
          .filter((b) => b.type === 'text' && b.text)
          .map((b) => b.text!)
          .join('\n')
          .trim()

        if (!content) continue

        const msg: ChatMessage = {
          role: m.sender === 'human' ? 'user' : 'assistant',
          content,
        }

        if (m.parent_message_uuid !== undefined && parentSeen.has(m.parent_message_uuid)) {
          messages[parentSeen.get(m.parent_message_uuid)!] = msg
        } else {
          parentSeen.set(m.parent_message_uuid ?? m.uuid, messages.length)
          messages.push(msg)
        }
      }

      if (messages.length === 0) return null

      const title = data.name || (messages[0]?.content.slice(0, 80) ?? 'Claude chat')

      return {
        platform: 'claude',
        conversationId,
        title,
        url: `https://claude.ai/chat/${conversationId}`,
        messages,
        capturedAt: new Date(),
      }
    } catch {
      return null
    }
  },
}
