/**
 * Bridges the first-run consent decision (ConsentBanner) to analytics.
 *
 * PostHog only captures once the visitor has actively **Accepted**. "Essential
 * only", a Global Privacy Control signal (recorded as essential by the banner),
 * or no decision yet all resolve to false — keeping the product's promise that
 * optional collection stays off until it's turned on.
 */

// Must match ConsentBanner.tsx.
const CONSENT_KEY = "misir.privacyConsent"

/** Custom event the banner dispatches so analytics can react without a reload. */
export const CONSENT_CHANGED_EVENT = "misir:consent-changed"

/** True only when the stored decision is an affirmative "accepted". */
export function analyticsConsentGranted(): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { decision?: string }
    return parsed.decision === "accepted"
  } catch {
    return false
  }
}
