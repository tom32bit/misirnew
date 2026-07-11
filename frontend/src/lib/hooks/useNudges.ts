"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useApi } from "../api/client"
import { nudgesApi, type ListNudgesOpts } from "../api/nudges"

export function useNudges(opts: ListNudgesOpts = {}) {
  const k = useApi()
  return useQuery({
    queryKey: ["nudges", opts],
    queryFn: () => nudgesApi.list(k, opts),
  })
}

export function useDismissNudge() {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "dismissed" | "acted" }) =>
      nudgesApi.patch(k, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nudges"] }),
  })
}

/** Mark active nudges seen (viewed the notifications list) — clears the badge. */
export function useMarkNudgesSeen() {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (spaceId?: number) => nudgesApi.markSeen(k, spaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nudges"] }),
  })
}
