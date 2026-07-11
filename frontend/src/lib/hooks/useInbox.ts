"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useApi } from "../api/client"
import { inboxApi, type ListInboxOpts } from "../api/inbox"

export function useInbox(opts: ListInboxOpts = {}) {
  const k = useApi()
  return useQuery({
    queryKey: ["inbox", opts],
    queryFn: () => inboxApi.list(k, opts),
  })
}

/** Mark a conversation read (opened) — clears its unread state everywhere. */
export function useMarkConversationRead() {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: number) => inboxApi.markRead(k, conversationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  })
}
