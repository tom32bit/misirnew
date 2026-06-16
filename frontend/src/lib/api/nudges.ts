import type { KyInstance } from "ky"
import type { Nudge, NudgeStatus } from "./types"

export type ListNudgesOpts = {
  status?: NudgeStatus
  spaceId?: number
}

export const nudgesApi = {
  list: (k: KyInstance, opts: ListNudgesOpts = {}) => {
    const searchParams: Record<string, string | number> = {}
    if (opts.status) searchParams.status = opts.status
    if (opts.spaceId != null) searchParams.space_id = opts.spaceId
    return k.get("nudges", { searchParams }).json<Nudge[]>()
  },

  patch: (k: KyInstance, id: number, status: "dismissed" | "acted") =>
    k.patch(`nudges/${id}`, { json: { status } }).json<Nudge>(),
}
