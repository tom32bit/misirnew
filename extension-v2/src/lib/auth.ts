/**
 * Clerk JWT token management for the extension
 * Stores token in chrome.storage.session (survives SW restarts)
 */

const TOKEN_KEY = 'misirClerkToken'
const TOKEN_EXPIRY_KEY = 'misirClerkTokenExpiry'

// Token expiry buffer (5 minutes before actual expiry)
const EXPIRY_BUFFER_MS = 5 * 60 * 1000

export async function cacheClerkToken(token: string): Promise<void> {
  if (!token) {
    await chrome.storage.session.remove([TOKEN_KEY, TOKEN_EXPIRY_KEY])
    return
  }

  try {
    // Parse JWT to get expiry
    const payload = JSON.parse(atob(token.split('.')[1]))
    const expiry = (payload.exp * 1000) - EXPIRY_BUFFER_MS

    await chrome.storage.session.set({
      [TOKEN_KEY]: token,
      [TOKEN_EXPIRY_KEY]: expiry,
    })
  } catch {
    // If parsing fails, just store token without expiry
    await chrome.storage.session.set({ [TOKEN_KEY]: token })
  }
}

// The Clerk session JWT lives in the frontend's `__session` cookie. Reading it
// directly (via chrome.cookies) makes auth self-sufficient: the service worker
// and popup can obtain a token without the frontend having to postMessage one.
const FRONTEND_URL =
  (import.meta.env?.VITE_CLERK_SYNC_HOST as string) || 'http://localhost:3000'

function decodeJwtPayload(jwt: string): Record<string, any> | null {
  const parts = jwt.split('.')
  if (parts.length !== 3) return null
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4
    if (pad) b64 += '='.repeat(4 - pad)
    return JSON.parse(atob(b64))
  } catch {
    return null
  }
}

function decodeJwtExp(jwt: string): number | null {
  const exp = decodeJwtPayload(jwt)?.exp
  return typeof exp === 'number' ? exp : null
}

export interface SessionClaims {
  sub?: string
  email?: string
}

/** Best-effort account info from the Clerk session cookie for the settings UI. */
export async function getSessionClaims(): Promise<SessionClaims | null> {
  try {
    const cookie = await chrome.cookies.get({ url: FRONTEND_URL, name: '__session' })
    if (!cookie?.value) return null
    const p = decodeJwtPayload(cookie.value)
    if (!p) return null
    return { sub: p.sub, email: p.email ?? p.email_address ?? p.primary_email }
  } catch {
    return null
  }
}

async function readSessionCookie(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({ url: FRONTEND_URL, name: '__session' })
    if (!cookie?.value) return null
    const exp = decodeJwtExp(cookie.value)
    // Reject an already-expired cookie token.
    if (exp && exp < Date.now() / 1000) return null
    return cookie.value
  } catch {
    return null
  }
}

export async function getCachedClerkToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.session.get([TOKEN_KEY, TOKEN_EXPIRY_KEY])
    const token = result[TOKEN_KEY]
    const expiry = result[TOKEN_EXPIRY_KEY]

    if (token && (!expiry || Date.now() < expiry)) return token

    // Cached token missing or expired — fall back to the frontend session cookie.
    if (token && expiry && Date.now() >= expiry) {
      await chrome.storage.session.remove([TOKEN_KEY, TOKEN_EXPIRY_KEY])
    }
    const cookieToken = await readSessionCookie()
    if (cookieToken) {
      await cacheClerkToken(cookieToken)
      return cookieToken
    }
    return null
  } catch {
    return null
  }
}

export async function clearClerkToken(): Promise<void> {
  await chrome.storage.session.remove([TOKEN_KEY, TOKEN_EXPIRY_KEY])
}

/**
 * Get token from Clerk's popup/auth flow
 * This is called when user signs in via the popup
 */
export async function getTokenFromClerk(): Promise<string | null> {
  // The frontend will postMessage the token after sign-in
  // We listen for it here
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'CLERK_TOKEN' && event.data.token) {
        window.removeEventListener('message', handler)
        resolve(event.data.token)
      }
    }
    window.addEventListener('message', handler)

    // Timeout after 30 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler)
      resolve(null)
    }, 30000)
  })
}