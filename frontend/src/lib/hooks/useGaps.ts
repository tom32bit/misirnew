"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useApi } from "../api/client"
import { gapsApi, type GapCreate, type GapUpdate } from "../api/gaps"

export function useGaps(spaceId: number | null | undefined) {
  const k = useApi()
  return useQuery({
    queryKey: ["gaps", spaceId],
    queryFn: () => gapsApi.list(k, spaceId as number),
    enabled: spaceId != null,
  })
}

export function useCreateGap(spaceId: number) {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: GapCreate) => gapsApi.create(k, spaceId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gaps", spaceId] }),
    retry: false,
  })
}

export function useUpdateGap(spaceId: number) {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ gapId, body }: { gapId: number; body: GapUpdate }) =>
      gapsApi.patch(k, spaceId, gapId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gaps", spaceId] }),
    retry: false,
  })
}
