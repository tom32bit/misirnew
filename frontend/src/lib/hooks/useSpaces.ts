"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useApi } from "../api/client"
import { spacesApi, type SpaceCreate, type SpaceGenerate } from "../api/spaces"

export function useSpaces() {
  const k = useApi()
  return useQuery({
    queryKey: ["spaces"],
    queryFn: () => spacesApi.list(k),
  })
}

export function useSpace(id: number | null | undefined) {
  const k = useApi()
  return useQuery({
    queryKey: ["space", id],
    queryFn: () => spacesApi.get(k, id as number),
    enabled: id != null,
  })
}

export function useCreateSpace() {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SpaceCreate) => spacesApi.create(k, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spaces"] }),
  })
}

export function useGenerateSpace() {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SpaceGenerate) => spacesApi.generate(k, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spaces"] }),
  })
}

export function useUpdateSpace() {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: import("../api/spaces").SpaceUpdate }) =>
      spacesApi.update(k, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spaces"] }),
  })
}

export function useDeleteSpace() {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => spacesApi.remove(k, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spaces"] }),
    retry: false,
  })
}
