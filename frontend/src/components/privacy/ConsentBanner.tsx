"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const KEY = "misir.privacyConsent"
const VERSION = "2026-06-07"

type Decision = "accepted" | "essential"

function record(decision: Decision, age18: boolean, gpc: boolean) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ decision, age18, gpc, version: VERSION, at: Date.now() }),
    )
  } catch {
    /* ignore */
  }
}

/**
 * Notice-at-collection + first-run consent (GDPR/ePrivacy/CCPA/PDPO) with an
 * age affirmation (must be 18+, the strictest of our launch markets). Honors the
 * Global Privacy Control signal automatically. Self-contained (localStorage);
 * backend capture consent is managed separately in the extension and Settings.
 */
export function ConsentBanner() {
  const [show, setShow] = useState(false)
  const [age18, setAge18] = useState(false)

  useEffect(() => {
    let decided = false
    try {
      decided = !!localStorage.getItem(KEY)
    } catch {
      /* ignore */
    }
    if (decided) return

    // Honor GPC silently: record an essential-only decision, don't nag.
    const nav = navigator as unknown as { globalPrivacyControl?: boolean }
    if (nav.globalPrivacyControl === true) {
      record("essential", false, true)
      return
    }
    setShow(true)
  }, [])

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Privacy and consent"
      className="fixed inset-x-0 bottom-0 z-[300] border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <p>
            Misir stores essential cookies to run the app. Optional content capture is{" "}
            <strong>off until you turn it on</strong>. See our{" "}
            <Link href="/privacy" className="text-primary underline">
              Privacy Policy
            </Link>
            .
          </p>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={age18}
              onChange={(e) => setAge18(e.target.checked)}
              className="h-4 w-4 cursor-pointer"
            />
            I confirm I am 18 years or older.
          </label>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              record("essential", age18, false)
              setShow(false)
            }}
          >
            Essential only
          </Button>
          <Button
            size="sm"
            disabled={!age18}
            title={age18 ? undefined : "Please confirm you are 18 or older"}
            onClick={() => {
              record("accepted", age18, false)
              setShow(false)
            }}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  )
}
