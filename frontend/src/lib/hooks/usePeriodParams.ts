"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import type { ReportPeriod } from "@/lib/api/types"

export type PeriodParams = {
  /** "today" | "week" | "month" — from ?period, defaults to "today". */
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
 */
export function usePeriodParams(): PeriodParams {
  const sp = useSearchParams()
  const period = (sp.get("period") ?? "today") as ReportPeriod
  const date = sp.get("date") ?? undefined
  const tzOffset = useMemo(() => new Date().getTimezoneOffset(), [])
  return { period, date, tzOffset }
}
