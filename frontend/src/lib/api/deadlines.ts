import type { KyInstance } from "ky"
import type { Deadline } from "./types"

export type DeadlineUpsert = {
  label: string
  due_at: string
  target_pct?: number
}

export const deadlinesApi = {
  get: (k: KyInstance, spaceId: number) =>
    k.get(`spaces/${spaceId}/deadline`).json<Deadline | null>(),

  upsert: (k: KyInstance, spaceId: number, body: DeadlineUpsert) =>
    k.put(`spaces/${spaceId}/deadline`, { json: body }).json<Deadline>(),

  remove: (k: KyInstance, spaceId: number) =>
    k.delete(`spaces/${spaceId}/deadline`).then(() => {}),
}
