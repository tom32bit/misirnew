"use client"

import { create } from "zustand"

export type ModalState =
  | null
  | { kind: "new-space" }
  | { kind: "new-chat"; defaultSpaceId?: number }
  | { kind: "edit-space"; spaceId: number }
  | { kind: "command" }
  | { kind: "shortcuts" }

type MisirAsksState = {
  expanded: boolean
  draft: string
  submitted: string | null
  answering: boolean
  response: string | null
  dismissed: boolean
}

const EMPTY_ASKS: MisirAsksState = {
  expanded: false,
  draft: "",
  submitted: null,
  answering: false,
  response: null,
  dismissed: false,
}

type UIState = {
  mobileMenuOpen: boolean
  modal: ModalState
  misirAsks: Record<number, MisirAsksState>
  nudgesDismissed: Set<number>

  setMobileMenuOpen(open: boolean): void
  toggleMobileMenu(): void

  openModal(m: NonNullable<ModalState>): void
  closeModal(): void

  asksFor(spaceId: number): MisirAsksState
  toggleAsks(spaceId: number): void
  setAsksDraft(spaceId: number, v: string): void
  submitAsks(spaceId: number, submitted: string): void
  setAsksAnswering(spaceId: number, on: boolean): void
  setAsksResponse(spaceId: number, response: string | null): void
  resetAsks(spaceId: number): void
  dismissAsks(spaceId: number): void

  dismissNudge(nudgeId: number): void
  restoreNudge(nudgeId: number): void
}

export const useUIStore = create<UIState>((set, get) => ({
  mobileMenuOpen: false,
  modal: null,
  misirAsks: {},
  nudgesDismissed: new Set<number>(),

  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),

  openModal: (m) => set({ modal: m }),
  closeModal: () => set({ modal: null }),

  asksFor: (spaceId) => get().misirAsks[spaceId] ?? EMPTY_ASKS,
  toggleAsks: (spaceId) =>
    set((s) => ({
      misirAsks: {
        ...s.misirAsks,
        [spaceId]: {
          ...(s.misirAsks[spaceId] ?? EMPTY_ASKS),
          expanded: !(s.misirAsks[spaceId]?.expanded ?? false),
        },
      },
    })),
  setAsksDraft: (spaceId, v) =>
    set((s) => ({
      misirAsks: {
        ...s.misirAsks,
        [spaceId]: { ...(s.misirAsks[spaceId] ?? EMPTY_ASKS), draft: v },
      },
    })),
  submitAsks: (spaceId, submitted) =>
    set((s) => ({
      misirAsks: {
        ...s.misirAsks,
        [spaceId]: {
          ...(s.misirAsks[spaceId] ?? EMPTY_ASKS),
          submitted,
          draft: "",
          answering: true,
          response: null,
        },
      },
    })),
  setAsksAnswering: (spaceId, on) =>
    set((s) => ({
      misirAsks: {
        ...s.misirAsks,
        [spaceId]: { ...(s.misirAsks[spaceId] ?? EMPTY_ASKS), answering: on },
      },
    })),
  setAsksResponse: (spaceId, response) =>
    set((s) => ({
      misirAsks: {
        ...s.misirAsks,
        [spaceId]: {
          ...(s.misirAsks[spaceId] ?? EMPTY_ASKS),
          response,
          answering: false,
        },
      },
    })),
  resetAsks: (spaceId) =>
    set((s) => ({ misirAsks: { ...s.misirAsks, [spaceId]: { ...EMPTY_ASKS } } })),
  dismissAsks: (spaceId) =>
    set((s) => ({
      misirAsks: {
        ...s.misirAsks,
        [spaceId]: { ...(s.misirAsks[spaceId] ?? EMPTY_ASKS), dismissed: true },
      },
    })),

  dismissNudge: (id) =>
    set((s) => {
      const next = new Set(s.nudgesDismissed)
      next.add(id)
      return { nudgesDismissed: next }
    }),

  restoreNudge: (id) =>
    set((s) => {
      const next = new Set(s.nudgesDismissed)
      next.delete(id)
      return { nudgesDismissed: next }
    }),
}))
