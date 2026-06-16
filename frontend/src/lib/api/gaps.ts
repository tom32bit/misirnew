import type { KyInstance } from "ky"
import type { Gap, GapSeverity, GapStatus } from "./types"

export type GapCreate = {
  label: string
  severity?: GapSeverity
  action?: string
}

export type GapUpdate = {
  label?: string
  severity?: GapSeverity
  action?: string
  status?: GapStatus
}

export const gapsApi = {
  list: (k: KyInstance, spaceId: number) =>
    k.get(`spaces/${spaceId}/gaps`).json<Gap[]>(),

  create: (k: KyInstance, spaceId: number, body: GapCreate) =>
    k.post(`spaces/${spaceId}/gaps`, { json: body }).json<Gap>(),

  patch: (k: KyInstance, spaceId: number, gapId: number, body: GapUpdate) =>
    k.patch(`spaces/${spaceId}/gaps/${gapId}`, { json: body }).json<Gap>(),
}
