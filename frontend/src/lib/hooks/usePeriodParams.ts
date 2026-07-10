"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import type { ReportPeriod } from "@/lib/api/types"

export type PeriodParams = {
  /** "today" | "week" | "month" — from ?period, defaults to "month". */
  period: ReportPeriod
  /** Specific date string "yyyy-MM-dd" from ?date, or undefined. When set,
   *  overrides period for data fetching (shows that calendar day only). */
  date: string | undefined
  /** JS Date.getTimezoneOffset() — stable for the session. */
  tzOffset: number
}

/**
 * Single source of truth for the current period/date selection.
 * All views should use this instead of reading searchParams directly.
 *
 * The Topbar period scrubber + calendar were removed for the MVP (they made the
 * app feel empty on open and added a power-user mental model that isn't core).
 * Nothing writes ?period/?date anymore, so this default governs everywhere —
 * a broad "month" window keeps the dashboard populated. The plumbing below and
 * downstream stays intact, so restoring the control later is a small revert.
 */
export function usePeriodParams(): PeriodParams {
  const sp = useSearchParams()
  const period = (sp.get("period") ?? "month") as ReportPeriod
  const date = sp.get("date") ?? undefined
  const tzOffset = useMemo(() => new Date().getTimezoneOffset(), [])
  return { period, date, tzOffset }
}
