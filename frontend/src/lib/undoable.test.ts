/**
 * The undo pattern stands in for confirm() on destructive actions, so its
 * failure modes are asymmetric: committing twice can double-delete, and never
 * committing means the UI said "deleted" while the server never heard.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import { undoableAction } from "./undoable"

// Capture the options sonner is handed so the toast lifecycle can be driven
// directly — the real toast needs a mounted <Toaster/> and real timers.
const toastCalls: { message: string; opts: Record<string, unknown> }[] = []

vi.mock("sonner", () => ({
  toast: (message: string, opts: Record<string, unknown>) => {
    toastCalls.push({ message, opts })
  },
}))

const last = () => toastCalls[toastCalls.length - 1]
const autoClose = () => (last().opts.onAutoClose as () => void)()
const dismiss = () => (last().opts.onDismiss as () => void)()
const clickUndo = () =>
  ((last().opts.action as { onClick: () => void }).onClick)()

beforeEach(() => {
  toastCalls.length = 0
})

describe("undoableAction", () => {
  it("does not commit while the toast is still open", () => {
    // The action must stay recoverable for the toast's lifetime.
    const onCommit = vi.fn()
    undoableAction({ message: "Deleted", onCommit, onUndo: vi.fn() })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it("commits when the toast auto-closes", () => {
    const onCommit = vi.fn()
    undoableAction({ message: "Deleted", onCommit, onUndo: vi.fn() })
    autoClose()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it("commits when the toast is dismissed", () => {
    const onCommit = vi.fn()
    undoableAction({ message: "Deleted", onCommit, onUndo: vi.fn() })
    dismiss()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it("undoes instead of committing when Undo is clicked", () => {
    const onCommit = vi.fn()
    const onUndo = vi.fn()
    undoableAction({ message: "Deleted", onCommit, onUndo })
    clickUndo()
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it("does not commit after Undo, even when the toast then closes", () => {
    // sonner fires onDismiss/onAutoClose after the action too; Undo must win.
    const onCommit = vi.fn()
    undoableAction({ message: "Deleted", onCommit, onUndo: vi.fn() })
    clickUndo()
    autoClose()
    dismiss()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it("commits only once when both close paths fire", () => {
    // Double-committing a delete would fire the mutation twice.
    const onCommit = vi.fn()
    undoableAction({ message: "Deleted", onCommit, onUndo: vi.fn() })
    autoClose()
    dismiss()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it("passes the message, description and duration to the toast", () => {
    undoableAction({
      message: "Deleted space",
      description: "3 captures",
      onCommit: vi.fn(),
      onUndo: vi.fn(),
      duration: 1234,
    })
    expect(last().message).toBe("Deleted space")
    expect(last().opts.description).toBe("3 captures")
    expect(last().opts.duration).toBe(1234)
  })

  it("defaults to a 5s window", () => {
    undoableAction({ message: "Deleted", onCommit: vi.fn(), onUndo: vi.fn() })
    expect(last().opts.duration).toBe(5000)
  })

  it("labels the action Undo", () => {
    undoableAction({ message: "Deleted", onCommit: vi.fn(), onUndo: vi.fn() })
    expect((last().opts.action as { label: string }).label).toBe("Undo")
  })

  describe("pagehide flush", () => {
    it("commits a pending action when the page goes away", () => {
      // Without this, navigating away inside the toast window meant the UI had
      // shown "deleted" but the mutation never fired.
      const onCommit = vi.fn()
      undoableAction({ message: "Deleted", onCommit, onUndo: vi.fn() })
      window.dispatchEvent(new Event("pagehide"))
      expect(onCommit).toHaveBeenCalledTimes(1)
    })

    it("does not commit an action that was already undone", () => {
      const onCommit = vi.fn()
      undoableAction({ message: "Deleted", onCommit, onUndo: vi.fn() })
      clickUndo()
      window.dispatchEvent(new Event("pagehide"))
      expect(onCommit).not.toHaveBeenCalled()
    })

    it("does not re-commit an action that already committed", () => {
      const onCommit = vi.fn()
      undoableAction({ message: "Deleted", onCommit, onUndo: vi.fn() })
      autoClose()
      window.dispatchEvent(new Event("pagehide"))
      expect(onCommit).toHaveBeenCalledTimes(1)
    })

    it("flushes every pending action, not just the newest", () => {
      const first = vi.fn()
      const second = vi.fn()
      undoableAction({ message: "One", onCommit: first, onUndo: vi.fn() })
      undoableAction({ message: "Two", onCommit: second, onUndo: vi.fn() })
      window.dispatchEvent(new Event("pagehide"))
      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
    })
  })

  it("keeps concurrent actions independent", () => {
    const firstCommit = vi.fn()
    const secondCommit = vi.fn()
    undoableAction({ message: "One", onCommit: firstCommit, onUndo: vi.fn() })
    const firstToast = last()
    undoableAction({ message: "Two", onCommit: secondCommit, onUndo: vi.fn() })

    ;(firstToast.opts.onAutoClose as () => void)()
    expect(firstCommit).toHaveBeenCalledTimes(1)
    expect(secondCommit).not.toHaveBeenCalled()
  })
})
