"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import { useApi } from "../api/client"
import { dashboardApi } from "../api/dashboard"
import type { ReportPeriod } from "../api/types"

export function useDashboard(
  spaceId: number | null | undefined,
  period: ReportPeriod = "week",
  tzOffset?: number,
  date?: string,
) {
  const k = useApi()
  return useQuery({
    queryKey: ["dashboard", spaceId, period, tzOffset, date],
    queryFn: () => dashboardApi.get(k, spaceId as number, period, tzOffset, date),
    enabled: spaceId != null,
  })
}

/**
 * Fans out one dashboard query per space. React Query handles caching, so
 * each space is fetched at most once per `[id, period]` per refresh window.
 */
export function useDashboards(
  spaceIds: number[],
  period: ReportPeriod = "week",
  tzOffset?: number,
  date?: string,
) {
  const k = useApi()
  return useQueries({
    queries: spaceIds.map((id) => ({
      queryKey: ["dashboard", id, period, tzOffset, date],
      queryFn: () => dashboardApi.get(k, id, period, tzOffset, date),
    })),
  })
}
