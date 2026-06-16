"use client"

/**
 * Drives the sidebar + mobile-nav badge counts.
 *
 * Backend doesn't expose per-conversation unread flags yet, so for now we
 * proxy "Inbox" as the count of conversations updated in the last 24h
 * (a stable, useful approximation). "Notifications" counts active critical
 * nudges. Both values are scope-aware: when a specific space is open, the
 * count is filtered to that space.
 */

import { useMemo } from "react"
import { useInbox } from "./useInbox"
import { useNudges } from "./useNudges"
import { useParams } from "next/navigation"

const ONE_DAY_MS = 24 * 60 * 60 * 1000

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
    const now = Date.now()
    const inboxUnread =
      (inbox.data ?? []).filter((c) => {
        const t = Date.parse(c.updated_at)
        return Number.isFinite(t) && now - t < ONE_DAY_MS
      }).length

    const notifCritical = (nudges.data ?? []).filter((n) => n.priority >= 3).length

    return { inboxUnread, notifCritical }
  }, [inbox.data, nudges.data])
}
