"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/misir/primitives/Button"
import { Icon } from "@/components/misir/primitives/Icon"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[dashboard error]", error)
    }
  }, [error])

  return (
    <div className="mx-auto mt-24 max-w-md rounded-panel border border-border bg-bg p-8 text-center">
      <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] text-[var(--color-danger)]">
        <Icon name="alert-triangle" size={18} />
      </div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
        Something went off the rails
      </div>
      <h2 className="mb-2 font-display text-[22px] font-semibold tracking-tight text-fg">
        Misir tripped on this view.
      </h2>
      <p className="mb-5 text-[13px] leading-[1.55] text-fg-muted">
        {error.message ||
          "An unexpected error happened while rendering this page."}
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button variant="primary" onClick={reset}>
          <Icon name="rotate-ccw" size={12} />
          Retry
        </Button>
        <Link href="/dashboard">
          <Button variant="ghost">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
