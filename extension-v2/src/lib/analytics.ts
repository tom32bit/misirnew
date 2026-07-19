/**
 * Product analytics for the extension (PostHog).
 *
 * Why a hand-rolled fetch client instead of posthog-js:
 *   - The background service worker has no DOM/window/localStorage, which
 *     posthog-js assumes.
 *   - The extension CSP (`script-src 'self' 'wasm-unsafe-eval'`) blocks the
 *     remote array.js / recorder scripts posthog-js pulls in.
 * A direct POST to PostHog's capture endpoint works identically in the service
 * worker and in the popup/sidepanel/options pages, needs only host_permissions,
 * and keeps us to explicit, metadata-only events (no autocapture / replay) —
 * exactly the conservative posture this privacy-first extension wants.
 *
 * Consent: capturing is OFF unless the user has granted at least one capture
 * purpose (web or AI-chat) AND Global Privacy Control is not signalling opt-out.
 * That ties analytics to the same affirmative choice that gates content capture.
 */
import { getConsent, gpcOptOut } from './consent'
import { getSessionClaims } from './auth'

const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string) || 'https://us.i.posthog.com'
const POSTHOG_TOKEN = (import.meta.env.VITE_POSTHOG_TOKEN as string) || ''

// Stable anonymous id for events fired before/without sign-in.
const ANON_ID_KEY = 'misirAnalyticsAnonId'

function extensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version
  } catch {
    return 'unknown'
  }
}

/** True only with a configured token, no GPC opt-out, and a granted purpose. */
async function analyticsAllowed(): Promise<boolean> {
  if (!POSTHOG_TOKEN) return false
  if (gpcOptOut()) return false
  const c = await getConsent()
  return c.webCapture === true || c.aiChatCapture === true
}

async function getDistinctId(): Promise<string> {
  try {
    const claims = await getSessionClaims()
    if (claims?.sub) return claims.sub
  } catch {
    /* fall through to anon */
  }
  try {
    const r = await chrome.storage.local.get(ANON_ID_KEY)
    if (r[ANON_ID_KEY]) return r[ANON_ID_KEY] as string
    const id = crypto.randomUUID()
    await chrome.storage.local.set({ [ANON_ID_KEY]: id })
    return id
  } catch {
    return crypto.randomUUID()
  }
}

/**
 * Fire one event, best-effort. Silently no-ops when analytics isn't allowed or
 * on any failure — must never disrupt capture or the UI.
 */
export async function captureEvent(
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    if (!(await analyticsAllowed())) return
    const distinct_id = await getDistinctId()
    await fetch(`${POSTHOG_HOST.replace(/\/$/, '')}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        api_key: POSTHOG_TOKEN,
        event,
        distinct_id,
        properties: {
          ...properties,
          $lib: 'misir-extension',
          extension_version: extensionVersion(),
        },
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    /* best-effort */
  }
}
