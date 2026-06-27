"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useApi } from "../api/client"
import { artifactsApi, type ListArtifactsOpts } from "../api/artifacts"

export function useArtifacts(opts: ListArtifactsOpts, refetchInterval?: number) {
  const k = useApi()
  return useQuery({
    queryKey: ["artifacts", opts],
    queryFn: () => artifactsApi.list(k, opts),
    refetchInterval,
  })
}

export function useDeleteArtifact(opts: ListArtifactsOpts) {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (artifactId: number) => artifactsApi.remove(k, artifactId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["artifacts", opts] }),
    retry: false,
  })
}
