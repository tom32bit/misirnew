"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useApi } from "../api/client"
import { deadlinesApi, type DeadlineUpsert } from "../api/deadlines"

export function useDeadline(spaceId: number | null | undefined) {
  const k = useApi()
  return useQuery({
    queryKey: ["deadline", spaceId],
    queryFn: () => deadlinesApi.get(k, spaceId as number),
    enabled: spaceId != null,
  })
}

export function useUpsertDeadline(spaceId: number) {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DeadlineUpsert) => deadlinesApi.upsert(k, spaceId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deadline", spaceId] }),
  })
}

export function useRemoveDeadline(spaceId: number) {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => deadlinesApi.remove(k, spaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deadline", spaceId] }),
  })
}
