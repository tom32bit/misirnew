"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  SectionHead,
} from "@/components/misir/primitives/Card"
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

export function InboxView({ scope }: { scope: Scope }) {
  const router = useRouter()
  const search = useSearchParams()
  const openModal = useUIStore((s) => s.openModal)
  const { data: spaces = [] } = useSpaces()
  const isAll = scope === "all"

  const inbox = useInbox(isAll ? {} : { spaceId: scope })
  const list: (Conversation & { unread: boolean })[] = useMemo(
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
      return (c.title ?? "").toLowerCase().includes(q)
    })

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
      <SectionHead
        icon="inbox"
        title="Inbox"
        small="All conversations with Misir"
        right={
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
        }
      />

      <Card className="overflow-hidden p-0">
        <FilterBar>
          <Segmented value={filter} onChange={setFilter} options={segOpts} />
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
            placeholder="Search subject…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[200px]"
          />
          <FilterCount>
            {filtered.length} of {total}
          </FilterCount>
        </FilterBar>

        {inbox.isLoading ? (
          // Row-shaped skeletons — never present "loading" as "empty".
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="grid items-center gap-3.5 border-b border-border px-[18px] py-3 last:border-b-0 mobile:grid-cols-[14px_1fr] mobile:gap-2.5"
              style={{ gridTemplateColumns: "18px 1fr 120px" }}
            >
              <Skeleton className="h-[6px] w-[6px] rounded-full" />
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
          filtered.map((c) => (
            <InboxRow
              key={c.id}
              conv={c}
              isAll={isAll}
              spaces={spaces}
              onClick={() => router.push(`/dashboard/chat/${c.id}`)}
            />
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
  conv: Conversation & { unread: boolean }
  isAll: boolean
  spaces: Space[]
  onClick: () => void
}) {
  const space = spaces.find((s) => s.id === conv.space_id) ?? null
  const color = space ? getSpaceColor(space) : "var(--accent)"
  const at = relTime(conv.updated_at)

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
      className="grid cursor-pointer items-center gap-3.5 border-b border-border px-[18px] py-3 transition-colors last:border-b-0 hover:bg-bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus)] mobile:grid-cols-[14px_1fr] mobile:gap-2.5"
      style={{ gridTemplateColumns: "18px 1fr 120px" }}
    >
      <span
        className={[
          "block h-[6px] w-[6px] rounded-full",
          conv.unread
            ? "bg-accent animate-[pulse-dot_1.8s_ease-in-out_infinite]"
            : "bg-[var(--fg-faint)]",
        ].join(" ")}
      />

      <div className="flex min-w-0 flex-col gap-1">
        <div
          className={[
            "font-serif text-[13.5px] text-fg",
            conv.unread ? "font-semibold" : "font-medium",
          ].join(" ")}
        >
          {conv.title ?? "Untitled conversation"}
        </div>
        <div className="line-clamp-1 font-serif text-[12.5px] leading-[1.5] text-fg-muted">
          {snippetFor(conv)}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 mobile:hidden">
        <span className="font-mono text-[10.5px] text-fg-subtle">{at}</span>
        {isAll && space && <SpaceTag color={color}>{space.name}</SpaceTag>}
      </div>
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

function snippetFor(conv: Conversation): string {
  return conv.title
    ? `Last activity ${relTime(conv.updated_at)}.`
    : "Misir is still preparing this thread."
}
