/**
 * Client instrumentation — runs before the app becomes interactive (Next.js
 * file convention). This is where PostHog is initialized.
 *
 * Two project-specific twists on top of the vanilla PostHog snippet:
 *
 *  1) Reverse proxy — `api_host` is our own /ingest path (rewritten to PostHog
 *     in next.config.ts), so nothing external is contacted and the CSP stays
 *     'self'. `ui_host` still points at PostHog so in-app toolbar links resolve.
 *
 *  2) Consent gating — capturing starts opted-OUT and only turns on once the
 *     visitor has actively Accepted in the ConsentBanner. We listen for the
 *     banner's change event to flip live, no reload needed.
 */
import posthog from "posthog-js"
import { analyticsConsentGranted, CONSENT_CHANGED_EVENT } from "@/lib/analytics/consent"

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
// Where the PostHog UI lives, derived from the ingestion host's region.
const uiHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(
  "://us.i.",
  "://us.",
).replace("://eu.i.", "://eu.")

// No token configured → analytics is inert (local dev, preview without a key).
if (token) {
  try {
    posthog.init(token, {
      // Same-origin proxy; see rewrites in next.config.ts.
      api_host: "/ingest",
      ui_host: uiHost,
      // PostHog's recommended baseline (automatic pageviews incl. SPA route
      // changes, autocapture, web vitals, etc).
      defaults: "2026-05-30",
      // Only create a person profile once we identify a signed-in user; anon
      // landing traffic stays event-only and cheaper.
      person_profiles: "identified_only",
      // Start silent; opt in below only with affirmative consent.
      opt_out_capturing_by_default: true,
    })

    if (analyticsConsentGranted()) posthog.opt_in_capturing()

    // React to Accept / Essential-only chosen after load.
    window.addEventListener(CONSENT_CHANGED_EVENT, () => {
      if (analyticsConsentGranted()) posthog.opt_in_capturing()
      else posthog.opt_out_capturing()
    })
  } catch {
    // Instrumentation failures must never break the app.
  }
}
