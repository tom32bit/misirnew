/**
 * Backend API client for the extension service worker.
 *
 * All calls go to the Misir backend (never directly to Supabase).
 * Auth token is retrieved from chrome.storage.session, which survives
 * SW idle-kill without touching module-scope variables (§2.3 of the plan).
 */

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:8000'
const API_V1 = `${BACKEND_URL}/api/v1`
const FRONTEND_URL = (import.meta.env.VITE_CLERK_SYNC_HOST as string) || 'http://localhost:3000'

// Thrown when the backend refuses a capture because the user hasn't opted in.
// Callers surface an opt-in notice instead of treating it as a hard failure.
export class ConsentRequiredError extends Error {
  readonly code = 'consent_required'
  purpose?: string
  constructor(message: string, purpose?: string) {
    super(message)
    this.name = 'ConsentRequiredError'
    this.purpose = purpose
  }
}

// ── Token management (§2.3) ──────────────────────────────────────────────────

interface CachedToken {
  jwt: string
  expiresAt: number
}

/**
 * Decode a JWT's payload claims. JWTs are base64URL-encoded (uses '-' and '_',
 * no padding), which atob() rejects with InvalidCharacterError — so normalize to
 * standard base64 and pad before decoding, and UTF-8 decode so non-ASCII claims
 * (e.g. email) survive. Returns null on any malformed input. Used by both the SW
 * (getBackendToken) and the UI (useAuth) so they decode identically.
 */
export function decodeJwtPayload(jwt: string): Record<string, any> | null {
  const parts = jwt.split('.')
  if (parts.length !== 3) return null
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4
    if (pad) b64 += '='.repeat(4 - pad)
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Retrieve a valid Clerk JWT.
 * 1. Try chrome.storage.session (survives SW idle-kill).
 * 2. If expired/missing, signal the popup/offscreen to refresh.
 *    For simplicity here we send a message to the extension's own
 *    offscreen document or popup to get a fresh token.
 */
async function getBackendToken(): Promise<string | null> {
  const cached = await chrome.storage.session.get('clerkToken') as { clerkToken?: CachedToken }
  if (cached.clerkToken && cached.clerkToken.expiresAt > Date.now() + 30_000) {
    return cached.clerkToken.jwt
  }
  // Read the __session cookie directly — works in service worker and popup contexts
  try {
    const cookie = await chrome.cookies.get({ url: FRONTEND_URL, name: '__session' })
    if (!cookie?.value) return null
    const payload = decodeJwtPayload(cookie.value)
    if (!payload?.sub || (payload.exp && payload.exp < Date.now() / 1000)) return null
    const token: CachedToken = { jwt: cookie.value, expiresAt: Date.now() + 50_000 }
    await chrome.storage.session.set({ clerkToken: token })
    return cookie.value
  } catch {
    return null
  }
}

export async function cacheClerkToken(jwt: string): Promise<void> {
  const token: CachedToken = { jwt, expiresAt: Date.now() + 50_000 }
  await chrome.storage.session.set({ clerkToken: token })
}

export async function clearClerkToken(): Promise<void> {
  await chrome.storage.session.remove('clerkToken')
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = await getBackendToken()
  if (!token) throw new Error('Not authenticated — open Misir to sign in')

  const res = await fetch(`${API_V1}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  if (res.status === 401 && retry) {
    // Force token refresh and retry once
    await clearClerkToken()
    return apiFetch<T>(path, options, false)
  }

  if (!res.ok) {
    const errText = await res.text()
    if (res.status === 403) {
      let detail: { code?: string; purpose?: string; message?: string } | null = null
      try {
        detail = JSON.parse(errText)?.detail ?? null
      } catch {
        detail = null
      }
      if (detail && detail.code === 'consent_required') {
        throw new ConsentRequiredError(detail.message || 'Capture consent required', detail.purpose)
      }
    }
    throw new Error(`API ${res.status}: ${errText}`)
  }

  return res.json() as Promise<T>
}

// ── API methods ───────────────────────────────────────────────────────────────

export async function apiGetMe() {
  return apiFetch('/me')
}

// Sync capture consent to the backend ledger so the server-side capture gate
// (REQUIRE_CAPTURE_CONSENT) agrees with the extension's local consent. Without
// this, opting in via the extension would still be blocked by a 403 server-side.
export async function apiSetConsent(
  consents: { purpose: string; granted: boolean }[],
  gpc = false,
) {
  return apiFetch('/me/consent', {
    method: 'PUT',
    body: JSON.stringify({ consents, gpc }),
  })
}

export async function apiCapture(body: object) {
  return apiFetch('/artifacts/capture', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function apiUpdateEngagement(artifactId: number, body: object) {
  return apiFetch(`/artifacts/${artifactId}/engagement`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function apiGetCache() {
  return apiFetch<{ spaces: any[]; subspaces: any[]; markers: any[] }>('/cache')
}

export async function apiGetArtifacts(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return apiFetch(`/artifacts${qs ? `?${qs}` : ''}`)
}
