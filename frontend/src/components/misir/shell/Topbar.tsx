"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { format, isToday, parseISO } from "date-fns"
import { Icon } from "@/components/misir/primitives/Icon"
import { useUIStore } from "@/lib/stores/ui-store"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { getSpaceColor } from "@/lib/constants/space-colors"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const VIEW_LABELS: Record<string, string> = {
  home: "Home",
  overview: "Overview",
  inbox: "Inbox",
  notification: "Notification",
  collection: "Collection",
  comparison: "Comparison",
  decision: "Decision tree",
  settings: "Settings",
}

const PERIODS = ["today", "week", "month"] as const
const PERIOD_LABELS: Record<(typeof PERIODS)[number], string> = {
  today: "Today",
  week: "This week",
  month: "This month",
}

export function Topbar() {
  const params = useParams<{ scope?: string; view?: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const toggleMobile = useUIStore((s) => s.toggleMobileMenu)
  const { data: spaces = [] } = useSpaces()
  const [calOpen, setCalOpen] = useState(false)

  const scope = params?.scope ?? "all"
  const view = params?.view ?? "home"
  const viewLabel = VIEW_LABELS[view] ?? "Home"

  const isAll = scope === "all"
  const activeSpace = isAll
    ? null
    : spaces.find((s) => String(s.id) === scope) ?? null

  // "today" is now the default — no ?period param means today
  const customDate = searchParams.get("date")
  const currentPeriod = (searchParams.get("period") ?? "today") as
    (typeof PERIODS)[number]
  const periodIdx = PERIODS.indexOf(currentPeriod)
  const safePeriodIdx = periodIdx === -1 ? 0 : periodIdx

  const periodLabel = customDate
    ? format(parseISO(customDate), "MMM d, yyyy")
    : PERIOD_LABELS[PERIODS[safePeriodIdx]]

  // Arrow navigation always operates on presets; clears any custom date
  const setPeriod = (idx: number) => {
    const clamped = Math.max(0, Math.min(PERIODS.length - 1, idx))
    const next = PERIODS[clamped]
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete("date")
    if (next === "today") sp.delete("period") // today is default → cleaner URL
    else sp.set("period", next)
    const qs = sp.toString()
    router.replace(qs ? `?${qs}` : "?")
  }

  // Calendar date pick
  const onDateSelect = (date: Date | undefined) => {
    if (!date) return
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete("period")
    if (isToday(date)) {
      sp.delete("date") // today from calendar = same as "Today" preset
    } else {
      sp.set("date", format(date, "yyyy-MM-dd"))
    }
    const qs = sp.toString()
    router.replace(qs ? `?${qs}` : "?")
    setCalOpen(false)
  }

  const calSelected = customDate ? parseISO(customDate) : new Date()

  return (
    <div
      className="grid h-[52px] flex-none items-center gap-4 border-b border-border px-[18px] mobile:h-12 mobile:grid-cols-[auto_1fr_auto] mobile:gap-2 mobile:px-2.5"
      style={{ gridTemplateColumns: "1fr auto 1fr" }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px]">
        <button
          type="button"
          aria-label="Open menu"
          onClick={toggleMobile}
          className="hidden h-8 w-8 place-items-center rounded-md text-fg-muted hover:bg-[var(--bg-hover)] hover:text-fg mobile:grid"
        >
          <Icon name="menu" size={16} />
        </button>

        {isAll ? (
          /* Global views — just the view name, no space picker */
          <span className="text-[13px] font-medium text-fg">{viewLabel}</span>
        ) : (
          <span
            className="font-serif text-[13px] font-medium text-fg"
            style={
              activeSpace ? { color: getSpaceColor(activeSpace) } : undefined
            }
          >
            {activeSpace?.name ?? "Space"}
          </span>
        )}
      </div>

      {/* Period scrubber */}
      <div className="flex items-center gap-2 justify-self-center mobile:hidden">
        <button
          type="button"
          aria-label="Previous range"
          onClick={() => setPeriod(safePeriodIdx - 1)}
          disabled={!customDate && safePeriodIdx === 0}
          className="grid h-6 w-6 place-items-center rounded-sm border border-border bg-bg text-fg-muted hover:border-border-strong hover:text-fg disabled:opacity-30"
        >
          <Icon name="chevron-left" size={13} />
        </button>

        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="min-w-[96px] rounded px-2 py-0.5 text-center text-[13px] font-medium text-fg transition-colors hover:bg-[var(--bg-hover)]"
            >
              {periodLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
            <Calendar
              mode="single"
              selected={calSelected}
              onSelect={onDateSelect}
              autoFocus
            />
          </PopoverContent>
        </Popover>

        <button
          type="button"
          aria-label="Next range"
          onClick={() => setPeriod(safePeriodIdx + 1)}
          disabled={!customDate && safePeriodIdx === PERIODS.length - 1}
          className="grid h-6 w-6 place-items-center rounded-sm border border-border bg-bg text-fg-muted hover:border-border-strong hover:text-fg disabled:opacity-30"
        >
          <Icon name="chevron-right" size={13} />
        </button>
      </div>

      {/* Desktop right column: empty. Mobile: compact period cycle button. */}
      <div className="justify-self-end">
        <button
          type="button"
          aria-label="Switch time range"
          onClick={() => setPeriod((safePeriodIdx + 1) % PERIODS.length)}
          className="hidden mobile:flex items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1 font-mono text-[11px] font-medium text-fg-muted active:bg-bg-muted"
        >
          {customDate
            ? new Date(customDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : PERIODS[safePeriodIdx] === "today"
              ? "Today"
              : PERIODS[safePeriodIdx] === "week"
                ? "Week"
                : "Month"}
          <Icon name="chevron-right" size={11} />
        </button>
      </div>
    </div>
  )
}
