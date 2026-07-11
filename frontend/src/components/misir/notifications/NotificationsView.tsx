"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Icon } from "@/components/misir/primitives/Icon"
import { Button } from "@/components/misir/primitives/Button"
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
import { useNudges, useMarkNudgesSeen } from "@/lib/hooks/useNudges"
import { useGaps } from "@/lib/hooks/useGaps"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { getSpaceColor } from "@/lib/constants/space-colors"
import { useUIStore } from "@/lib/stores/ui-store"
import type { Gap, Nudge, Space } from "@/lib/api/types"
import { NudgeCard } from "./NudgeCard"

type Scope = "all" | number
type Severity = "all" | "critical" | "warning" | "info"

type Row = {
  key: string
  severity: Exclude<Severity, "all">
  title: string
  body: string
  at: string
  ctaLabel: string
  spaceId: number | null
  source: "nudge" | "gap"
  refId: number
}

function nudgeSeverity(n: Nudge): Exclude<Severity, "all"> {
  if (n.priority >= 3) return "critical"
  if (n.priority === 2) return "warning"
  return "info"
}

function gapSeverity(g: Gap): Exclude<Severity, "all"> {
  if (g.severity === "Critical") return "critical"
  if (g.severity === "High") return "warning"
  return "info"
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
  return `${d}d ago`
}

export function NotificationsView({ scope }: { scope: Scope }) {
  const router = useRouter()
  const search = useSearchParams()
  const { data: spaces = [] } = useSpaces()
  const isAll = scope === "all"

  // Nudges always available; gaps fetched per-space only.
  const nudges = useNudges(isAll ? { status: "active" } : { status: "active", spaceId: scope })
  const gaps = useGaps(isAll ? null : scope)

  // "Mark all read" marks the active nudges seen — clears the sidebar unread
  // badge. Explicit (not on mount) so the button has a visible effect.
  const markSeen = useMarkNudgesSeen()

  const [filter, setFilter] = useState<Severity>(
    (search.get("f") as Severity) ?? "all",
  )
  const [spaceFilter, setSpaceFilter] = useState<string>(
    search.get("space") ?? "all",
  )

  const rows: Row[] = useMemo(() => {
    const all: Row[] = []
    for (const n of nudges.data ?? []) {
      all.push({
        key: `n-${n.id}`,
        severity: nudgeSeverity(n),
        title: n.scatter,
        body: n.direction,
        at: relTime(n.generated_at),
        ctaLabel: n.cta_label?.trim() || "Open",
        spaceId: n.space_id,
        source: "nudge",
        refId: n.id,
      })
    }
    if (!isAll) {
      for (const g of gaps.data ?? []) {
        if (g.status === "resolved") continue
        all.push({
          key: `g-${g.id}`,
          severity: gapSeverity(g),
          title: g.label,
          body: g.action ?? "Open the subspace to investigate.",
          at: relTime(g.last_seen_at ?? g.created_at),
          ctaLabel: "Investigate",
          spaceId: g.space_id,
          source: "gap",
          refId: g.id,
        })
      }
    }
    return all
  }, [nudges.data, gaps.data, isAll])

  const filtered = rows
    .filter((r) => (filter === "all" ? true : r.severity === filter))
    .filter((r) =>
      isAll && spaceFilter !== "all"
        ? String(r.spaceId) === spaceFilter
        : true,
    )

  const counts = {
    all: rows.length,
    critical: rows.filter((r) => r.severity === "critical").length,
    warning: rows.filter((r) => r.severity === "warning").length,
    info: rows.filter((r) => r.severity === "info").length,
  }

  const segOpts: SegmentOption<Severity>[] = [
    { value: "all", label: "All", count: counts.all },
    {
      value: "critical",
      label: "Critical",
      count: counts.critical,
      highlight: counts.critical > 0,
    },
    { value: "warning", label: "Warning", count: counts.warning },
    { value: "info", label: "Info", count: counts.info },
  ]

  // Highest-priority active nudge for the current scope drives the top card.
  const topNudge = (nudges.data ?? [])
    .filter((n) => (isAll ? true : n.space_id === scope))
    .sort((a, b) => b.priority - a.priority)[0]
  const topNudgeSpace =
    topNudge && spaces.find((s) => s.id === topNudge.space_id)

  const unreadCount = (nudges.data ?? []).filter((n) => !n.seen_at).length

  const markAllRead = () => {
    if (markSeen.isPending) return
    markSeen.mutate(isAll ? undefined : (scope as number), {
      onSuccess: () =>
        toast.success("All caught up", {
          description: "Notifications marked as read.",
        }),
      onError: () =>
        toast.error("Couldn't mark as read", {
          description: "Please try again in a moment.",
        }),
    })
  }

  return (
    <>
      <SectionHead
        title="Notifications"
        small="Alerts, nudges, and gaps Misir is watching"
        right={
          <Button
            variant="ghost"
            onClick={markAllRead}
            disabled={markSeen.isPending || unreadCount === 0}
          >
            {markSeen.isPending
              ? "Marking…"
              : unreadCount > 0
                ? `Mark all read (${unreadCount})`
                : "All read"}
          </Button>
        }
      />

      {topNudge && <NudgeCard nudge={topNudge} space={topNudgeSpace ?? null} />}

      <Card className="p-0 overflow-hidden">
        <FilterBar>
          <Segmented value={filter} onChange={setFilter} options={segOpts} />
          {isAll && spaces.length > 0 && (
            <select
              value={spaceFilter}
              onChange={(e) => setSpaceFilter(e.target.value)}
              className="h-7 cursor-pointer rounded-md border border-border bg-bg px-2.5 text-[12.5px] text-fg outline-none focus:border-accent"
            >
              <option value="all">All spaces</option>
              {spaces.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <FilterCount>
            {filtered.length} of {rows.length}
          </FilterCount>
        </FilterBar>

        {filtered.length === 0 ? (
          <div className="px-6 py-8 text-center text-[13px] text-fg-subtle">
            {rows.length === 0
              ? "Misir hasn't noticed anything urgent yet."
              : "No notifications match."}
          </div>
        ) : (
          filtered.map((r) => (
            <NotificationRow
              key={r.key}
              row={r}
              spaces={spaces}
              isAll={isAll}
              onAction={() => {
                const sid = r.spaceId ?? (isAll ? null : (scope as number))
                if (sid != null) {
                  router.push(
                    r.source === "gap"
                      ? `/dashboard/${sid}/decision`
                      : `/dashboard/${sid}/home`,
                  )
                } else {
                  router.push("/dashboard/all/decision")
                }
              }}
            />
          ))
        )}
      </Card>
    </>
  )
}

function NotificationRow({
  row,
  spaces,
  isAll,
  onAction,
}: {
  row: Row
  spaces: Space[]
  isAll: boolean
  onAction: () => void
}) {
  const space = row.spaceId != null ? spaces.find((s) => s.id === row.spaceId) : null
  const color = space ? getSpaceColor(space) : "var(--accent)"

  const sevClass = {
    critical: "text-accent",
    warning: "text-warning",
    info: "text-fg-muted",
  }[row.severity]

  const dotClass = {
    critical: "bg-accent animate-[pulse-dot_1.8s_ease-in-out_infinite]",
    warning: "bg-warning",
    info: "bg-[var(--fg-faint)]",
  }[row.severity]

  return (
    <div
      className="grid items-start gap-4 border-b border-border px-[18px] py-3.5 last:border-b-0 hover:bg-bg-muted mobile:grid-cols-[72px_1fr] mobile:gap-2.5"
      style={{ gridTemplateColumns: "100px 1fr auto" }}
    >
      <span
        className={["inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em]", sevClass].join(" ")}
      >
        <span className={["block h-[6px] w-[6px] rounded-full", dotClass].join(" ")} />
        {row.severity}
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <div className="text-[13.5px] font-medium leading-[1.45] text-fg">
          {row.title}
        </div>
        <div className="text-[12.5px] leading-[1.5] text-fg-muted">{row.body}</div>
        {isAll && space && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <SpaceTag color={color}>{space.name}</SpaceTag>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 mobile:hidden">
        <span className="whitespace-nowrap font-mono text-[10.5px] text-fg-subtle">
          {row.at}
        </span>
        <Button variant="default" onClick={onAction}>
          {row.ctaLabel}
          <Icon name="arrow-right" size={12} />
        </Button>
      </div>
    </div>
  )
}
