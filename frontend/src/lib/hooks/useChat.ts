"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useApi } from "../api/client"
import { chatApi, streamChatMessage } from "../api/chat"
import { API_URL } from "../env"

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
  /** The message being sent, until the refetched list includes it — render it
   *  as an optimistic user bubble so the question stays on screen while the
   *  reply streams. */
  pendingUserMessage: string | null
  error: string | null
}

export function useSendMessageStream(conversationId: number): Streaming {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  const [isStreaming, setIsStreaming] = useState(false)
  const [partial, setPartial] = useState("")
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(
    async (content: string) => {
      if (!content.trim()) return
      setError(null)
      setIsStreaming(true)
      setPartial("")
      setPendingUserMessage(content)

      const token = await getToken()

      try {
        let acc = ""
        for await (const chunk of streamChatMessage({
          base: API_URL,
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
        // Refetch the persisted messages FIRST, and only then clear the
        // streamed/optimistic copies — clearing before the refetch resolved
        // made the whole exchange blink out of the thread and reappear.
        try {
          await qc.invalidateQueries({
            queryKey: ["chat", conversationId, "messages"],
          })
        } catch {
          /* refetch errors surface via the query itself */
        }
        qc.invalidateQueries({ queryKey: ["inbox"] })
        setIsStreaming(false)
        setPartial("")
        setPendingUserMessage(null)
      }
    },
    [conversationId, getToken, qc],
  )

  return { send, isStreaming, partial, pendingUserMessage, error }
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
