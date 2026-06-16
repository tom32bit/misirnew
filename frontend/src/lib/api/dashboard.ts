import type { KyInstance } from "ky"
import type { DashboardPayload, ReportPeriod } from "./types"

export const dashboardApi = {
  get: (k: KyInstance, spaceId: number, period: ReportPeriod = "week") =>
    k
      .get(`dashboard/${spaceId}`, {
        searchParams: { period },
      })
      .json<DashboardPayload>(),

  /** Force a Stage A + Stage B cache refresh. Server enqueues an async job. */
  regenerate: (k: KyInstance, spaceId: number, period: ReportPeriod = "week") =>
    k
      .post("reports/regenerate", {
        searchParams: { space_id: spaceId, period },
      })
      .json<{ queued: true }>(),
}
