"use client"

import { useEffect } from "react"
import { API_URL } from "@/lib/env"

/**
 * Fire-and-forget ping to wake the backend.
 *
 * The API sleeps after ~15 minutes idle and takes 30–50s to boot. A cron keeps
 * it warm most of the time, but when it isn't, the cost lands on the first real
 * request — which is the dashboard load, i.e. exactly when the user is waiting.
 *
 * Mounting this on the pages that PRECEDE the dashboard (sign-in, sign-up)
 * spends that boot while the user is typing their password instead. By the time
 * they land, the container is up.
 *
 * Deliberately unauthenticated and ignored: /health needs no token, and nothing
 * here should be able to fail a render. It is a side effect, not a dependency.
 */
export function WarmBackend() {
  useEffect(() => {
    const origin = API_URL.replace(/\/api\/v\d+\/?$/, "")
    const controller = new AbortController()

    fetch(`${origin}/health`, {
      signal: controller.signal,
      cache: "no-store",
      mode: "cors",
    }).catch(() => {
      // Offline, still booting, CORS — all fine. The real request will retry.
    })

    return () => controller.abort()
  }, [])

  return null
}
