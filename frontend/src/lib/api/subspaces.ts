import type { KyInstance } from "ky"
import type { Subspace } from "./types"

export type SubspaceCreate = { name: string; description?: string }
export type SubspaceUpdate = Partial<SubspaceCreate>

export const subspacesApi = {
  list: (k: KyInstance, spaceId: number) =>
    k.get(`spaces/${spaceId}/subspaces`).json<Subspace[]>(),

  create: (k: KyInstance, spaceId: number, body: SubspaceCreate) =>
    k.post(`spaces/${spaceId}/subspaces`, { json: body }).json<Subspace>(),

  update: (
    k: KyInstance,
    spaceId: number,
    subspaceId: number,
    body: SubspaceUpdate,
  ) =>
    k
      .patch(`spaces/${spaceId}/subspaces/${subspaceId}`, { json: body })
      .json<Subspace>(),

  remove: (k: KyInstance, spaceId: number, subspaceId: number) =>
    k.delete(`spaces/${spaceId}/subspaces/${subspaceId}`).then(() => {}),
}
