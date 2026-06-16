import type { ChatAdapter } from './types'
import type { ChatCapture, ChatMessage } from '@/types/chat'

// GET /backend-api/conversation/{conversationId}
// Auth: Authorization + oai-device-id header (both required)
//   - token: fetched from /api/auth/session?unstable_client=true, or inject-web fallback
//   - oai-device-id: document.cookie oai-did value
//
// API structure: mapping[nodeId] = { id, message: GPTMessage | null, parent, children[] }
// Conversations are trees — traverse from root following last child (current branch).

interface GPTMessage {
  id: string
  author: { role: string } | null
  content: { content_type: string; parts: (string | object)[] } | null
  create_time: number | null
  recipient?: string
}

interface GPTNode {
  id: string
  message: GPTMessage | null
  parent: string | null
  children: string[]
}

async function getSessionToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session?unstable_client=true', { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    return data?.accessToken ? `Bearer ${data.accessToken}` : null
  } catch {
    return null
  }
}

function getDeviceId(): string | null {
  try {
    const m = document.cookie.match(/oai-did=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}

function extractTextParts(parts: (string | object)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join('\n')
    .trim()
}

function collectBranchMessages(mapping: Record<string, GPTNode>, rootNode: GPTNode): ChatMessage[] {
  const messages: ChatMessage[] = []

  function traverse(nodeId: string): void {
    const node = mapping[nodeId]
    if (!node) return

    const msg = node.message
    if (msg?.author && msg.content) {
      const role = msg.author.role
      if ((role === 'user' || role === 'assistant') && msg.content.content_type === 'text') {
        const content = extractTextParts(msg.content.parts ?? [])
        if (content) {
          messages.push({
            role: role as 'user' | 'assistant',
            content,
            createdAt: msg.create_time ? new Date(msg.create_time * 1000) : undefined,
          })
        }
      }
    }

    // Follow the last child — when a message is edited/regenerated, new children are
    // appended, so the last child is always the current active branch.
    const children = node.children ?? []
    if (children.length > 0) traverse(children[children.length - 1])
  }

  for (const childId of rootNode.children ?? []) traverse(childId)
  return messages
}

export const chatgptAdapter: ChatAdapter = {
  platform: 'chatgpt',
  needsInjectWeb: false,
  triggerSelector: '[data-message-author-role]',

  matches: (url) => url.includes('chatgpt.com/c/'),

  getConversationId: (url) => {
    const m = url.match(/\/c\/([a-f0-9-]{36})/i)
    return m?.[1] ?? null
  },

  async fetchConversation(conversationId, auth): Promise<ChatCapture | null> {
    try {
      const token = auth?.authorization ?? await getSessionToken()
      if (!token) return null

      const deviceId = getDeviceId()
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Authorization': token,
        ...(auth?.extraHeaders ?? {}),
      }
      if (deviceId) headers['oai-device-id'] = deviceId

      const res = await fetch(`/backend-api/conversation/${conversationId}`, {
        credentials: 'include',
        headers,
      })
      if (!res.ok) return null
      const data = await res.json()

      const mapping: Record<string, GPTNode> = data.mapping ?? {}

      const rootNode: GPTNode | undefined =
        mapping['client-created-root'] ??
        Object.values(mapping).find((n) => n.parent === null)

      if (!rootNode) return null

      const messages = collectBranchMessages(mapping, rootNode)
      if (messages.length === 0) return null

      const title = data.title || (messages.find((m) => m.role === 'user')?.content.slice(0, 80) ?? 'ChatGPT chat')

      return {
        platform: 'chatgpt',
        conversationId,
        title,
        url: `https://chatgpt.com/c/${conversationId}`,
        messages,
        capturedAt: new Date(),
      }
    } catch {
      return null
    }
  },
}
