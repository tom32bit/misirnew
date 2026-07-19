"use client"

import { useEffect } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import posthog from "posthog-js"

/**
 * Ties the PostHog person to the Clerk identity: identify on sign-in, reset on
 * sign-out. Renders nothing. No-ops when PostHog was never initialized (no
 * token) — posthog-js swallows calls before init.
 *
 * We identify with the Clerk user id (stable, non-PII) and attach email only so
 * the PostHog person is recognizable in the UI; drop the email set here if you
 * want to keep PII out of the analytics store entirely.
 */
export function PostHogIdentify() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { user } = useUser()

  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn && userId) {
      const email = user?.primaryEmailAddress?.emailAddress
      posthog.identify(userId, email ? { email } : undefined)
    } else {
      // Signed out: clear the identity so the next visitor is a fresh anon.
      posthog.reset()
    }
  }, [isLoaded, isSignedIn, userId, user])

  return null
}
