import type { ChatAdapter } from './types'
import type { ChatCapture, ChatMessage } from '@/types/chat'

// POST https://www.kimi.com/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages
// Auth: kimi-auth is HttpOnly so document.cookie can't read it.
// The background script reads it via chrome.cookies API (bypasses HttpOnly) and passes it here.

const ROOT_PARENT_ID = '00000000-0000-0000-0000-000000000000'
const LIST_MESSAGES_URL = 'https://www.kimi.com/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages'

interface KimiMessage {
  id: string
  parentId: string
  childrenMessageIds: string[]
  role: string
  status: string
  blocks: { text?: { content: string } }[]
}

async function getKimiToken(): Promise<string | null> {
  try {
    const res: { value: string | null } = await chrome.runtime.sendMessage({
      type: 'GET_COOKIE',
      url: 'https://www.kimi.com',
      name: 'kimi-auth',
    })
    return res?.value ? `Bearer ${res.value}` : null
  } catch {
    return null
  }
}

function extractText(blocks: KimiMessage['blocks']): string {
  return blocks
    .filter((b) => typeof b.text?.content === 'string')
    .map((b) => b.text!.content.trim())
    .filter(Boolean)
    .join('\n\n')
}

export const kimiAdapter: ChatAdapter = {
  platform: 'kimi',
  needsInjectWeb: false,
  triggerSelector: '[class*="message"], [data-message-id]',

  matches: (url) => url.includes('www.kimi.com'),

  getConversationId: (url) => {
    const m = url.match(/\/chat\/([a-zA-Z0-9_-]+)/i)
    return m?.[1] ?? null
  },

  async fetchConversation(conversationId): Promise<ChatCapture | null> {
    try {
      const token = await getKimiToken()
      if (!token) return null

      const res = await fetch(LIST_MESSAGES_URL, {
        method: 'POST',
        credentials: 'include',
        headers: {
          accept: '*/*',
          authorization: token,
          'connect-protocol-version': '1',
          'content-type': 'application/json',
          origin: 'https://www.kimi.com',
          'x-language': 'zh-CN',
          'x-msh-platform': 'web',
          'x-msh-version': '1.0.0',
        },
        body: JSON.stringify({ chat_id: conversationId, page_size: 1000 }),
      })
      if (!res.ok) return null

      const data = await res.json()
      const raw: KimiMessage[] = data.messages ?? []
      if (raw.length === 0) return null

      const byId = new Map(raw.map((m) => [m.id, m]))
      const root = raw.find((m) => m.parentId === ROOT_PARENT_ID)
      if (!root) return null

      const messages: ChatMessage[] = []
      let cursor: string | undefined = root.childrenMessageIds?.at(-1)

      while (cursor) {
        const msg = byId.get(cursor)
        if (!msg) break
        if (
          (msg.role === 'user' || msg.role === 'assistant') &&
          msg.status === 'MESSAGE_STATUS_COMPLETED'
        ) {
          const content = extractText(msg.blocks ?? [])
          if (content) messages.push({ role: msg.role as 'user' | 'assistant', content })
        }
        cursor = msg.childrenMessageIds?.at(-1)
      }

      if (messages.length === 0) return null

      const firstUser = messages.find((m) => m.role === 'user')
      return {
        platform: 'kimi',
        conversationId,
        title: firstUser?.content.slice(0, 80) ?? 'Kimi chat',
        url: location.href,
        messages,
        capturedAt: new Date(),
      }
    } catch {
      return null
    }
  },
}
