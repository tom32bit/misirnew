"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronRight, Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card } from "@/components/misir/primitives/Card"
import {
  FilterBar,
  FilterCount,
  Segmented,
  type SegmentOption,
} from "@/components/misir/primitives/FilterBar"
import { SpaceTag } from "@/components/misir/primitives/Tag"
import { Skeleton } from "@/components/misir/primitives/Skeleton"
import { useInbox } from "@/lib/hooks/useInbox"
import { isConversationUnread } from "@/lib/hooks/useUnreadCounts"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { useUIStore } from "@/lib/stores/ui-store"
import { getSpaceColor } from "@/lib/constants/space-colors"
import type { Conversation, Space } from "@/lib/api/types"

type Scope = "all" | number
type Row = Conversation & { unread: boolean }

/** Recency buckets — they give a short list a spine instead of a flat run. */
const BUCKETS = ["Today", "This week", "Earlier"] as const
type Bucket = (typeof BUCKETS)[number]

export function InboxView({ scope }: { scope: Scope }) {
  const router = useRouter()
  const search = useSearchParams()
  const openModal = useUIStore((s) => s.openModal)
  const { data: spaces = [] } = useSpaces()
  const isAll = scope === "all"

  const inbox = useInbox(isAll ? {} : { spaceId: scope })
  const list: Row[] = useMemo(
    () => (inbox.data ?? []).map((c) => ({ ...c, unread: isConversationUnread(c) })),
    [inbox.data],
  )

  const [filter, setFilter] = useState<"all" | "unread">(
    (search.get("f") as "all" | "unread") ?? "all",
  )
  const [spaceFilter, setSpaceFilter] = useState<string>(
    search.get("space") ?? "all",
  )
  const [query, setQuery] = useState<string>(search.get("q") ?? "")

  const filtered = list
    .filter((c) => (filter === "unread" ? c.unread : true))
    .filter((c) =>
      isAll && spaceFilter !== "all"
        ? String(c.space_id) === spaceFilter
        : true,
    )
    .filter((c) => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      // Search what's on screen: the title and the visible message line.
      return [c.title, c.last_message_preview, c.opening_message]
        .some((s) => (s ?? "").toLowerCase().includes(q))
    })

  // Rows arrive newest-first, so each bucket keeps that order.
  const grouped = useMemo(() => {
    const map = new Map<Bucket, Row[]>()
    for (const c of filtered) {
      const b = bucketOf(c.updated_at)
      const arr = map.get(b)
      if (arr) arr.push(c)
      else map.set(b, [c])
    }
    return BUCKETS.filter((b) => map.has(b)).map((b) => [b, map.get(b)!] as const)
  }, [filtered])

  const total = list.length
  const unreadCount = list.filter((c) => c.unread).length

  const segOpts: SegmentOption<"all" | "unread">[] = [
    { value: "all", label: "All", count: total },
    {
      value: "unread",
      label: "Unread",
      count: unreadCount,
      highlight: unreadCount > 0,
    },
  ]

  return (
    <>
      {/* No icon, no "Inbox" heading: the Topbar already names this view, and
          repeating its icon and word here said the same thing twice. */}
      <div className="flex items-center justify-end gap-3 px-0.5 pb-0.5 pt-1.5">
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            openModal({
              kind: "new-chat",
              defaultSpaceId: isAll ? undefined : scope,
            })
          }
        >
          <Plus size={12} />
          New chat
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <FilterBar>
          {/* Nothing unread means "Unread 0" only ever filtered to an empty
              list. Unread is already legible in the dots and the summary, so
              the control appears when it can actually do something — and stays
              while it's the active filter, so you can get back to All. */}
          {(unreadCount > 0 || filter === "unread") && (
            <Segmented value={filter} onChange={setFilter} options={segOpts} />
          )}
          {isAll && spaces.length > 0 && (
            <Select value={spaceFilter} onValueChange={setSpaceFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All spaces</SelectItem>
                {spaces.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            type="text"
            placeholder="Search titles & messages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[200px]"
          />
          {/* "4 of 4" just restates the summary above; it only says something
              once a filter has actually narrowed the list. */}
          {filtered.length !== total && (
            <FilterCount>
              {filtered.length} of {total}
            </FilterCount>
          )}
        </FilterBar>

        {inbox.isLoading ? (
          // Row-shaped skeletons — never present "loading" as "empty".
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_178px] items-center gap-3.5 border-b border-border px-[18px] py-3 last:border-b-0 mobile:grid-cols-[1fr] mobile:gap-2.5"
            >
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-3 w-16 justify-self-end mobile:hidden" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-6 py-8 text-center text-[13px] text-fg-subtle">
            {total === 0 ? "No chats yet. Start one." : "No chats match."}
          </div>
        ) : (
          grouped.map(([bucket, rows]) => (
            <section key={bucket}>
              <div className="flex items-center gap-2.5 px-[18px] pb-2 pt-3.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
                  {bucket}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              {rows.map((c) => (
                <InboxRow
                  key={c.id}
                  conv={c}
                  isAll={isAll}
                  spaces={spaces}
                  onClick={() => router.push(`/dashboard/chat/${c.id}`)}
                />
              ))}
            </section>
          ))
        )}
      </Card>
    </>
  )
}

function InboxRow({
  conv,
  isAll,
  spaces,
  onClick,
}: {
  conv: Row
  isAll: boolean
  spaces: Space[]
  onClick: () => void
}) {
  const space = spaces.find((s) => s.id === conv.space_id) ?? null
  const color = space ? getSpaceColor(space) : "var(--accent)"
  const at = relTime(conv.updated_at)
  // No title yet, but the thread already exists — it's mid-naming, not empty.
  const naming = !conv.title
  // Misir answered and you left before reading it — the one case where a
  // thread genuinely changed behind your back.
  const unreadReply = conv.unread && conv.last_message_role === "misir"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className="group grid cursor-pointer grid-cols-[1fr_178px_12px] items-start gap-3.5 border-b border-border px-[18px] py-3 transition-colors last:border-b-0 hover:bg-bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus)] mobile:grid-cols-[1fr] mobile:gap-2.5"
    >
      {/* No status dot. Misir only ever writes to a thread while you're in it,
          so a conversation is essentially always read — a permanent dot column
          spent 18px saying nothing. The rare case (you left before the reply
          landed) is stated outright by the chip below instead. */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          {naming ? (
            <span className="flex items-center gap-1.5 font-serif text-[14px] italic text-fg-subtle">
              <Sparkles size={12} className="shrink-0 animate-pulse text-accent" />
              Naming this thread…
            </span>
          ) : (
            <span
              className={[
                "min-w-0 truncate font-serif text-[15px] leading-tight",
                conv.unread ? "font-semibold text-fg" : "font-normal text-fg-muted",
              ].join(" ")}
            >
              {conv.title}
            </span>
          )}
          {unreadReply && (
            <span className="shrink-0 rounded-full bg-[var(--color-accent-soft)] px-[7px] py-[2.5px] text-[10px] font-medium text-accent">
              New reply
            </span>
          )}
        </div>
        <div className="truncate font-serif text-[12.5px] leading-[1.5] text-fg-subtle">
          {snippetFor(conv)}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 pt-px mobile:hidden">
        <span className="font-mono text-[10px] tabular-nums text-fg-subtle">{at}</span>
        {isAll && space && (
          <SpaceTag color={color} className="max-w-full overflow-hidden">
            <span className="truncate">{space.name}</span>
          </SpaceTag>
        )}
      </div>

      <ChevronRight
        size={12}
        className="self-center text-fg-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 mobile:hidden"
      />
    </div>
  )
}

function relTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "—"
  const diff = Math.max(0, Date.now() - t)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return "Yesterday"
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  return `${w}w ago`
}

function bucketOf(iso: string): Bucket {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "Earlier"
  const days = (Date.now() - t) / 86_400_000
  if (days < 1) return "Today"
  if (days < 7) return "This week"
  return "Earlier"
}

/** The line under the title: what was actually last said, and by whom. */
function snippetFor(conv: Conversation): string {
  const body = conv.last_message_preview ?? conv.opening_message
  if (!body) return "No messages yet."
  const who = conv.last_message_preview
    ? conv.last_message_role === "misir"
      ? "Misir"
      : "You"
    : "You"
  return `${who} — ${body}`
}

