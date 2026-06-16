import type { KyInstance } from "ky"
import type { Conversation, ChatMessage } from "./types"

export type ConversationCreate = { space_id?: number; title?: string }

export const chatApi = {
  createConversation: (k: KyInstance, body: ConversationCreate) =>
    k.post("chat", { json: body }).json<Conversation>(),

  messages: (k: KyInstance, conversationId: number) =>
    k.get(`chat/${conversationId}/messages`).json<ChatMessage[]>(),

  deleteConversation: (k: KyInstance, conversationId: number) =>
    k.delete(`chat/${conversationId}`).then(() => {}),
}

/**
 * Streams a chat message via SSE-over-fetch. EventSource can't carry an
 * `Authorization` header, so we read `response.body` as a ReadableStream
 * and parse the `data:` frames ourselves.
 *
 * Yields `{ delta }` chunks as tokens arrive and a final `{ done: true }`.
 */
export async function* streamChatMessage(opts: {
  base: string
  token: string | null
  conversationId: number
  content: string
  signal?: AbortSignal
}): AsyncGenerator<{ delta?: string; done?: boolean; error?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`

  const res = await fetch(
    `${opts.base}/chat/${opts.conversationId}/messages`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ content: opts.content }),
      signal: opts.signal,
    },
  )

  if (!res.ok || !res.body) {
    yield { error: `chat HTTP ${res.status}` }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      let idx: number
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 2)
        if (!frame.startsWith("data:")) continue
        const payload = frame.slice(5).trim()
        try {
          yield JSON.parse(payload)
        } catch {
          // ignore malformed frame; keep streaming
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
