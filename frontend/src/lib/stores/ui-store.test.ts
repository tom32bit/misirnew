import { beforeEach, describe, expect, it } from "vitest"

import { useUIStore } from "./ui-store"

const get = () => useUIStore.getState()

const INITIAL = {
  mobileMenuOpen: false,
  modal: null,
  misirAsks: {},
  nudgesDismissed: new Set<number>(),
}

beforeEach(() => {
  // The store is a module singleton, so state leaks between tests without this.
  useUIStore.setState({ ...INITIAL, nudgesDismissed: new Set<number>() })
})

describe("mobile menu", () => {
  it("opens and closes", () => {
    get().setMobileMenuOpen(true)
    expect(get().mobileMenuOpen).toBe(true)
    get().setMobileMenuOpen(false)
    expect(get().mobileMenuOpen).toBe(false)
  })

  it("toggles from whatever the current state is", () => {
    get().toggleMobileMenu()
    expect(get().mobileMenuOpen).toBe(true)
    get().toggleMobileMenu()
    expect(get().mobileMenuOpen).toBe(false)
  })
})

describe("modals", () => {
  it("opens a modal and closes back to null", () => {
    get().openModal({ kind: "new-space" })
    expect(get().modal).toEqual({ kind: "new-space" })
    get().closeModal()
    expect(get().modal).toBeNull()
  })

  it("keeps a modal's payload", () => {
    get().openModal({ kind: "edit-space", spaceId: 5 })
    expect(get().modal).toEqual({ kind: "edit-space", spaceId: 5 })
  })

  it("replaces an open modal rather than stacking", () => {
    get().openModal({ kind: "new-space" })
    get().openModal({ kind: "command" })
    expect(get().modal).toEqual({ kind: "command" })
  })
})

describe("misirAsks", () => {
  it("returns a default state for a space that has never been touched", () => {
    expect(get().asksFor(1)).toEqual({
      expanded: false,
      draft: "",
      submitted: null,
      answering: false,
      response: null,
      dismissed: false,
    })
  })

  it("keeps each space's asks state independent", () => {
    // The panel is per-space; bleed between spaces would show one space's
    // draft under another.
    get().setAsksDraft(1, "for space one")
    get().setAsksDraft(2, "for space two")
    expect(get().asksFor(1).draft).toBe("for space one")
    expect(get().asksFor(2).draft).toBe("for space two")
  })

  it("toggles expanded from the default", () => {
    get().toggleAsks(1)
    expect(get().asksFor(1).expanded).toBe(true)
    get().toggleAsks(1)
    expect(get().asksFor(1).expanded).toBe(false)
  })

  it("preserves other fields when toggling", () => {
    get().setAsksDraft(1, "keep me")
    get().toggleAsks(1)
    expect(get().asksFor(1).draft).toBe("keep me")
  })

  it("clears the draft and starts answering on submit", () => {
    get().setAsksDraft(1, "my question")
    get().submitAsks(1, "my question")
    const s = get().asksFor(1)
    expect(s.submitted).toBe("my question")
    expect(s.draft).toBe("")
    expect(s.answering).toBe(true)
    expect(s.response).toBeNull()
  })

  it("clears a previous response when a new question is submitted", () => {
    // Otherwise the old answer sits under the new question while it loads.
    get().setAsksResponse(1, "old answer")
    get().submitAsks(1, "new question")
    expect(get().asksFor(1).response).toBeNull()
  })

  it("stops answering when a response arrives", () => {
    get().submitAsks(1, "q")
    get().setAsksResponse(1, "the answer")
    const s = get().asksFor(1)
    expect(s.response).toBe("the answer")
    expect(s.answering).toBe(false)
  })

  it("stops answering when a response comes back null (a failure)", () => {
    // A failed answer must not leave the panel spinning forever.
    get().submitAsks(1, "q")
    get().setAsksResponse(1, null)
    expect(get().asksFor(1).answering).toBe(false)
  })

  it("can set answering directly", () => {
    get().setAsksAnswering(1, true)
    expect(get().asksFor(1).answering).toBe(true)
  })

  it("resets one space back to empty without touching others", () => {
    get().setAsksDraft(1, "one")
    get().setAsksDraft(2, "two")
    get().resetAsks(1)
    expect(get().asksFor(1).draft).toBe("")
    expect(get().asksFor(2).draft).toBe("two")
  })

  it("marks a space dismissed", () => {
    get().dismissAsks(1)
    expect(get().asksFor(1).dismissed).toBe(true)
  })

  it("clears dismissed on reset", () => {
    get().dismissAsks(1)
    get().resetAsks(1)
    expect(get().asksFor(1).dismissed).toBe(false)
  })
})

describe("nudges", () => {
  it("dismisses and restores a nudge", () => {
    get().dismissNudge(7)
    expect(get().nudgesDismissed.has(7)).toBe(true)
    get().restoreNudge(7)
    expect(get().nudgesDismissed.has(7)).toBe(false)
  })

  it("tracks several dismissals", () => {
    get().dismissNudge(1)
    get().dismissNudge(2)
    expect(get().nudgesDismissed.has(1)).toBe(true)
    expect(get().nudgesDismissed.has(2)).toBe(true)
  })

  it("replaces the Set rather than mutating it", () => {
    // zustand compares by reference; mutating in place would not re-render the
    // notifications row.
    const before = get().nudgesDismissed
    get().dismissNudge(1)
    expect(get().nudgesDismissed).not.toBe(before)
  })

  it("is a no-op to restore a nudge that was never dismissed", () => {
    get().restoreNudge(99)
    expect(get().nudgesDismissed.size).toBe(0)
  })

  it("dismissing twice keeps one entry", () => {
    get().dismissNudge(1)
    get().dismissNudge(1)
    expect(get().nudgesDismissed.size).toBe(1)
  })
})
