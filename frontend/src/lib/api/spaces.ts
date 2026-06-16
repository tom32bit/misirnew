import type { KyInstance } from "ky"
import type { Space, SpaceGenerated } from "./types"

export type SpaceCreate = { name: string; goal?: string; description?: string }
export type SpaceGenerate = { name: string; intention?: string }
export type SpaceUpdate = Partial<SpaceCreate>

export const spacesApi = {
  list: (k: KyInstance) => k.get("spaces").json<Space[]>(),

  get: (k: KyInstance, id: number) => k.get(`spaces/${id}`).json<Space>(),

  create: (k: KyInstance, body: SpaceCreate) =>
    k.post("spaces", { json: body }).json<Space>(),

  /** Calls Groq to seed subspaces + markers on creation. */
  generate: (k: KyInstance, body: SpaceGenerate) =>
    k.post("spaces/generate", { json: body }).json<SpaceGenerated>(),

  update: (k: KyInstance, id: number, body: SpaceUpdate) =>
    k.patch(`spaces/${id}`, { json: body }).json<Space>(),

  remove: (k: KyInstance, id: number) => k.delete(`spaces/${id}`).then(() => {}),
}
