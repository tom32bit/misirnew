"use client"

import { useQuery } from "@tanstack/react-query"
import { useApi } from "../api/client"
import { inboxApi, type ListInboxOpts } from "../api/inbox"

export function useInbox(opts: ListInboxOpts = {}) {
  const k = useApi()
  return useQuery({
    queryKey: ["inbox", opts],
    queryFn: () => inboxApi.list(k, opts),
  })
}
