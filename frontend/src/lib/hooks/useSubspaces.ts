"use client"

import { useQuery } from "@tanstack/react-query"
import { useApi } from "../api/client"
import { subspacesApi } from "../api/subspaces"

export function useSubspaces(spaceId: number | null | undefined) {
  const k = useApi()
  return useQuery({
    queryKey: ["subspaces", spaceId],
    queryFn: () => subspacesApi.list(k, spaceId as number),
    enabled: spaceId != null,
  })
}
