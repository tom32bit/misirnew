/**
 * Bridge to the Misir browser extension.
 *
 * The extension injects a content script on the app that listens for these
 * window messages and immediately refreshes its offline cache
 * (spaces/subspaces/markers) — instead of waiting for its periodic 30-minute
 * sync. That way a space the user just created starts matching on open pages
 * right away. No-op if the extension isn't installed (nothing is listening).
 */
export function notifyExtensionSpacesChanged(): void {
  if (typeof window === "undefined") return
  try {
    window.postMessage(
      { source: "misir-app", type: "MISIR_SPACES_CHANGED" },
      window.location.origin,
    )
  } catch {
    /* extension not installed / postMessage blocked — ignore */
  }
}
