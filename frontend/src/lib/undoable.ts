import { toast } from "sonner"

/**
 * House pattern for destructive actions: act optimistically in the UI, show
 * a toast with an Undo action, and only COMMIT the server mutation once the
 * toast closes without Undo being clicked. Replaces confirm() dialogs — the
 * action feels instant and stays recoverable for the toast's lifetime.
 *
 * `onUndo` must restore the optimistic UI (e.g. invalidate the query so the
 * cache refetches the still-undeleted server state).
 */

// Commits waiting on their toast to close. Flushed on pagehide: without this,
// reloading/navigating away inside the toast window meant onCommit never fired
// — the UI had shown "deleted" but the server never heard about it. (The page
// is being torn down when we flush, so an in-flight request isn't guaranteed
// to complete — but firing it is strictly better than silently dropping it.)
const pendingCommits = new Set<() => void>()
let flushListenerBound = false

function bindFlushListener() {
  if (flushListenerBound || typeof window === "undefined") return
  flushListenerBound = true
  window.addEventListener("pagehide", () => {
    for (const commit of [...pendingCommits]) commit()
  })
}

export function undoableAction({
  message,
  description,
  onCommit,
  onUndo,
  duration = 5000,
}: {
  message: string
  description?: string
  onCommit: () => void
  onUndo: () => void
  duration?: number
}) {
  bindFlushListener()
  let settled = false

  const commit = () => {
    if (settled) return
    settled = true
    pendingCommits.delete(commit)
    onCommit()
  }
  pendingCommits.add(commit)

  toast(message, {
    description,
    duration,
    action: {
      label: "Undo",
      onClick: () => {
        settled = true
        pendingCommits.delete(commit)
        onUndo()
      },
    },
    // Both close paths commit; the `settled` flag makes them idempotent and
    // lets Undo win if it was clicked first.
    onAutoClose: commit,
    onDismiss: commit,
  })
}
