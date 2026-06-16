"use client"

/**
 * Drives the "Misir asks" submit path:
 *   1. Create a chat conversation scoped to the active space.
 *   2. POST the user's answer and stream the assistant reply.
 *   3. Accumulate deltas into the UI store.
 *   4. Fall back to a per-space canned response on stream error.
 */

import { useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { useUIStore } from "@/lib/stores/ui-store"
import { useApi } from "@/lib/api/client"
import { chatApi, streamChatMessage } from "@/lib/api/chat"
import { GENERIC_FALLBACK, type MisirQuestion } from "@/lib/constants/misir-questions"

export function useMisirAnswer(spaceId: number, question: MisirQuestion | null) {
  const k = useApi()
  const { getToken } = useAuth()
  const submitAsks = useUIStore((s) => s.submitAsks)
  const setAsksResponse = useUIStore((s) => s.setAsksResponse)

  const fallbackText = question?.fallback ?? GENERIC_FALLBACK

  return useCallback(
    async (answer: string) => {
      submitAsks(spaceId, answer)

      try {
        const conv = await chatApi.createConversation(k, { space_id: spaceId })
        const token = await getToken()
        const base = process.env.NEXT_PUBLIC_API_URL!

        let acc = ""
        let any = false
        for await (const chunk of streamChatMessage({
          base,
          token,
          conversationId: conv.id,
          content: answer,
        })) {
          if (chunk.error) throw new Error(chunk.error)
          if (chunk.delta) {
            any = true
            acc += chunk.delta
            setAsksResponse(spaceId, acc)
          }
          if (chunk.done) break
        }
        if (!any) setAsksResponse(spaceId, fallbackText)
      } catch {
        setAsksResponse(spaceId, fallbackText)
      }
    },
    [k, getToken, spaceId, submitAsks, setAsksResponse, fallbackText],
  )
}
