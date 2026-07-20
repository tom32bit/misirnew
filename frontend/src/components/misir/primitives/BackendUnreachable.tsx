"use client"

import { Icon } from "./Icon"

/**
 * Shown when a query fails outright rather than returning empty data.
 *
 * The backend runs on a free instance that sleeps after ~15 minutes idle, so
 * the most likely cause of a failure here is a 30–50s cold start that outlived
 * even the retries — not a broken deployment. The copy says that, because
 * "check your connection" sends people to debug their wifi for a server that is
 * simply booting.
 */
export function BackendUnreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-panel border border-border bg-bg px-6 py-12 text-center">
      <Icon name="alert-triangle" size={18} className="text-fg-subtle" />
      <div className="text-[14px] font-medium text-fg">Couldn&apos;t reach the server</div>
      <div className="max-w-[380px] text-[13px] text-fg-muted">
        It may be waking from sleep, which takes up to a minute. Try again in a moment.
      </div>
      <button
        onClick={onRetry}
        className="mt-1 rounded-md border border-border-strong bg-bg px-4 py-2 text-[13px] text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
      >
        Retry
      </button>
    </div>
  )
}
