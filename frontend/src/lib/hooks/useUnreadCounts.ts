"use client"

/**
 * Drives the sidebar + mobile-nav badge counts from real, persisted read state.
 *
 * "Inbox" counts conversations with activity newer than the user last opened
 * them (updated_at > last_read_at). "Notifications" counts active nudges the
 * user hasn't viewed yet (seen_at is null). Both are scope-aware: when a
 * specific space is open, counts are filtered to that space.
 */

import { useMemo } from "react"
import { useInbox } from "./useInbox"
import { useNudges } from "./useNudges"
import { useParams } from "next/navigation"
import type { Conversation, Nudge } from "@/lib/api/types"

/** A conversation is unread if it has activity since the user last opened it. */
export function isConversationUnread(c: Conversation): boolean {
  const updated = Date.parse(c.updated_at)
  if (!Number.isFinite(updated)) return false
  const readAt = c.last_read_at ? Date.parse(c.last_read_at) : NaN
  // Never opened → unread. Otherwise unread only if newer activity arrived.
  if (!Number.isFinite(readAt)) return true
  return updated > readAt
}

/** A notification is unread until the user has viewed the notifications list. */
export function isNudgeUnread(n: Nudge): boolean {
  return n.status === "active" && !n.seen_at
}

export function useUnreadCounts() {
  const params = useParams<{ scope?: string }>()
  const scope = params?.scope ?? "all"
  const spaceId = scope === "all" ? undefined : Number(scope)
  const validSpaceId = spaceId != null && !Number.isNaN(spaceId) ? spaceId : undefined

  const inbox = useInbox(validSpaceId != null ? { spaceId: validSpaceId } : {})
  const nudges = useNudges(
    validSpaceId != null
      ? { status: "active", spaceId: validSpaceId }
      : { status: "active" },
  )

  return useMemo(() => {
    const inboxUnread = (inbox.data ?? []).filter(isConversationUnread).length
    const notifUnread = (nudges.data ?? []).filter(isNudgeUnread).length
    return { inboxUnread, notifUnread }
  }, [inbox.data, nudges.data])
}
