import type { KyInstance } from "ky"
import type { Conversation } from "./types"

export type ListInboxOpts = {
  spaceId?: number
  limit?: number
  offset?: number
}

export const inboxApi = {
  list: (k: KyInstance, opts: ListInboxOpts = {}) => {
    const searchParams: Record<string, string | number> = {
      limit: opts.limit ?? 30,
      offset: opts.offset ?? 0,
    }
    if (opts.spaceId != null) searchParams.space_id = opts.spaceId
    return k.get("inbox", { searchParams }).json<Conversation[]>()
  },

  markRead: (k: KyInstance, conversationId: number) =>
    k.post(`inbox/${conversationId}/read`).json<{ id: number; last_read_at: string }>(),
}
