import type { KyInstance } from "ky"
import type { DashboardPayload, ReportPeriod } from "./types"

export const dashboardApi = {
  get: (
    k: KyInstance,
    spaceId: number,
    period: ReportPeriod = "week",
    tzOffset?: number,
    date?: string,
  ) => {
    const searchParams: Record<string, string | number> = { period }
    if (date) searchParams.date = date
    if ((period === "today" || date) && tzOffset != null) searchParams.tz_offset = tzOffset
    return k.get(`dashboard/${spaceId}`, { searchParams }).json<DashboardPayload>()
  },

  /** Force a Stage A + Stage B cache refresh. Server enqueues an async job. */
  regenerate: (k: KyInstance, spaceId: number, period: ReportPeriod = "week") =>
    k
      .post("reports/regenerate", {
        searchParams: { space_id: spaceId, period },
      })
      .json<{ queued: true }>(),
}
