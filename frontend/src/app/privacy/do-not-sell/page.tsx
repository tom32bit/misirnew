"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const KEY = "misir.doNotSell"

export default function DoNotSellPage() {
  const [optedOut, setOptedOut] = useState(false)
  const [gpc, setGpc] = useState(false)

  useEffect(() => {
    try {
      setOptedOut(localStorage.getItem(KEY) === "true")
    } catch {
      /* ignore */
    }
    const nav = navigator as unknown as { globalPrivacyControl?: boolean }
    if (nav.globalPrivacyControl === true) {
      setGpc(true)
      setOptedOut(true)
      try {
        localStorage.setItem(KEY, "true")
      } catch {
        /* ignore */
      }
    }
  }, [])

  function applyOptOut() {
    try {
      localStorage.setItem(KEY, "true")
    } catch {
      /* ignore */
    }
    setOptedOut(true)
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Do Not Sell or Share My Personal Information
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
        Misir does <strong>not</strong> sell your personal information, and does not share it for
        cross-context behavioral advertising. You can still record your preference below; we also
        automatically honor the browser-level <strong>Global Privacy Control (GPC)</strong> signal,
        and you may limit the use of sensitive personal information.
      </p>

      {gpc && (
        <p className="mt-4 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          We detected a Global Privacy Control signal from your browser and have applied your
          opt-out automatically.
        </p>
      )}

      <div className="mt-8 rounded-lg border border-border p-5">
        {optedOut ? (
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            ✓ Your opt-out preference is recorded. We will not sell or share your personal
            information.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Record a Do-Not-Sell/Share preference for this browser.
            </p>
            <Button onClick={applyOptOut}>Opt out</Button>
          </div>
        )}
      </div>

      <div className="mt-12 text-sm">
        <Link href="/privacy" className="text-primary underline">
          ← Back to Privacy Policy
        </Link>
      </div>
    </main>
  )
}
