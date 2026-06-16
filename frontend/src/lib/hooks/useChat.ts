"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useApi } from "../api/client"
import { chatApi, streamChatMessage } from "../api/chat"

export function useMessages(conversationId: number | null | undefined) {
  const k = useApi()
  return useQuery({
    queryKey: ["chat", conversationId, "messages"],
    queryFn: () => chatApi.messages(k, conversationId as number),
    enabled: conversationId != null,
  })
}

export type Streaming = {
  send(content: string): Promise<void>
  isStreaming: boolean
  partial: string
  error: string | null
}

export function useSendMessageStream(conversationId: number): Streaming {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  const [isStreaming, setIsStreaming] = useState(false)
  const [partial, setPartial] = useState("")
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(
    async (content: string) => {
      if (!content.trim()) return
      setError(null)
      setIsStreaming(true)
      setPartial("")

      const token = await getToken()
      const base = process.env.NEXT_PUBLIC_API_URL!

      try {
        let acc = ""
        for await (const chunk of streamChatMessage({
          base,
          token,
          conversationId,
          content,
        })) {
          if (chunk.error) throw new Error(chunk.error)
          if (chunk.delta) {
            acc += chunk.delta
            setPartial(acc)
          }
          if (chunk.done) break
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "stream failed")
      } finally {
        setIsStreaming(false)
        setPartial("")
        // Refetch the full message list to pick up persisted messages.
        qc.invalidateQueries({
          queryKey: ["chat", conversationId, "messages"],
        })
        qc.invalidateQueries({ queryKey: ["inbox"] })
      }
    },
    [conversationId, getToken, qc],
  )

  return { send, isStreaming, partial, error }
}

export function useDeleteConversation() {
  const k = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: number) => chatApi.deleteConversation(k, conversationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
    retry: false,
  })
}
