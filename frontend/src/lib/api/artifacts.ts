import type { KyInstance } from "ky"
import type { Artifact, PlatformType, ReportPeriod } from "./types"

export type ListArtifactsOpts = {
  spaceId?: number
  platform?: PlatformType
  tag?: string
  q?: string
  period?: ReportPeriod | "all"
  /** Specific date "yyyy-MM-dd" — overrides period for data fetching. */
  date?: string
  /** JS Date.getTimezoneOffset() — used with period="today" or date. */
  tzOffset?: number
  limit?: number
  offset?: number
}

export const artifactsApi = {
  list: (k: KyInstance, opts: ListArtifactsOpts = {}) => {
    const searchParams: Record<string, string | number> = {
      limit: opts.limit ?? 100,
      offset: opts.offset ?? 0,
    }
    if (opts.spaceId != null) searchParams.space_id = opts.spaceId
    if (opts.platform) searchParams.platform = opts.platform
    if (opts.tag) searchParams.tag = opts.tag
    if (opts.q) searchParams.q = opts.q
    if (opts.period && opts.period !== "all") searchParams.period = opts.period
    if (opts.date) searchParams.date = opts.date
    if ((opts.period === "today" || opts.date) && opts.tzOffset != null) searchParams.tz_offset = opts.tzOffset
    return k.get("artifacts", { searchParams }).json<Artifact[]>()
  },

  remove: (k: KyInstance, artifactId: number) =>
    k.delete(`artifacts/${artifactId}`).then(() => {}),
}
