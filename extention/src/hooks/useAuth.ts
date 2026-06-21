/**
 * Clerk auth hook for extension UI (popup, sidepanel, options).
 *
 * Reads the Clerk __session cookie directly from the frontend (localhost:3000).
 * The frontend keeps the cookie fresh (Clerk rotates it every ~60s), so we
 * re-read it every 45 seconds. The extension must have the `cookies` permission
 * and host access to http://localhost:3000/*.
 */
import { useEffect, useState, useCallback } from 'react'
import { cacheClerkToken, clearClerkToken, decodeJwtPayload } from '@/lib/api'

export interface AuthUser {
  id: string
  email: string
}

const FRONTEND_URL = (import.meta.env.VITE_CLERK_SYNC_HOST as string) || 'http://localhost:3000'
const REFRESH_MS = 45_000

async function readClerkCookie(): Promise<{ user: AuthUser; token: string; sid: string } | null> {
  try {
    const cookie = await chrome.cookies.get({ url: FRONTEND_URL, name: '__session' })
    if (!cookie?.value) return null

    const payload = decodeJwtPayload(cookie.value)
    if (!payload) return null

    // Reject if expired
    if (!payload.sub || (payload.exp && payload.exp < Date.now() / 1000)) return null

    const email =
      payload.email ||
      payload.email_address ||
      payload.primary_email_address ||
      payload.emailAddresses?.[0]?.emailAddress ||
      ''

    return { user: { id: payload.sub, email }, token: cookie.value, sid: payload.sid || payload.sub }
  } catch {
    return null
  }
}

// Read email directly from window.Clerk running in the frontend tab.
// This works without a backend — Clerk JS always has full user data.
async function fetchEmailFromFrontendTab(): Promise<string> {
  try {
    const tabs = await chrome.tabs.query({ url: `${FRONTEND_URL}/*` })
    const tabId = tabs[0]?.id
    if (!tabId) return ''

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const w = window as any
        return (
          w.Clerk?.user?.primaryEmailAddress?.emailAddress ||
          w.Clerk?.user?.emailAddresses?.[0]?.emailAddress ||
          ''
        )
      },
    })
    return (results?.[0]?.result as string) || ''
  } catch {
    return ''
  }
}

async function fetchEmailFromBackend(token: string): Promise<string> {
  try {
    const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:8000'
    const res = await fetch(`${BACKEND_URL}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data?.email || ''
  } catch {
    return ''
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  const sync = useCallback(async () => {
    const result = await readClerkCookie()
    if (result) {
      // If this is the same session the user explicitly signed out from, stay signed out
      const { misirSignedOutSid } = await chrome.storage.local.get(['misirSignedOutSid'])
      if (misirSignedOutSid && misirSignedOutSid === result.sid) {
        setUser(null)
        setToken(null)
        setLoading(false)
        return
      }
      // Different session means user signed back in from the frontend — clear the flag
      if (misirSignedOutSid) {
        await chrome.storage.local.remove(['misirSignedOutSid'])
      }

      let { email } = result.user

      if (!email) {
        email = await fetchEmailFromFrontendTab()
      }
      if (!email) {
        email = await fetchEmailFromBackend(result.token)
      }

      const user: AuthUser = { id: result.user.id, email }
      setUser(user)
      setToken(result.token)
      cacheClerkToken(result.token)
      // Persist only non-secret identity for instant UI on restart. The bearer
      // JWT is kept in chrome.storage.session (cacheClerkToken) only — never on
      // disk. Purge any token a previous build may have written.
      await chrome.storage.local.set({
        misirUser: { id: user.id, email: user.email || '' },
      })
      await chrome.storage.local.remove('misirToken')
    } else {
      setUser(null)
      setToken(null)
      clearClerkToken()
      await chrome.storage.local.remove(['misirUser', 'misirToken'])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { misirUser, misirSignedOutSid } = await chrome.storage.local.get([
        'misirUser', 'misirSignedOutSid',
      ])
      // Restore only non-secret identity for instant UI. The token is re-derived
      // from the live session cookie by sync() below — never read from disk.
      if (misirUser && !misirSignedOutSid) {
        setUser(misirUser)
        setLoading(false)
      }
      await sync()
    }
    init()
    const interval = setInterval(sync, REFRESH_MS)
    return () => clearInterval(interval)
  }, [sync])

  // Respond to SW requests for a fresh token
  useEffect(() => {
    const handler = (msg: any, _sender: any, sendResponse: (r: any) => void) => {
      if (msg.type === 'GET_CLERK_TOKEN') {
        readClerkCookie().then((result) => {
          if (result) {
            cacheClerkToken(result.token)
            sendResponse({ token: result.token })
          } else {
            sendResponse({ token: null })
          }
        })
        return true
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  const signOut = useCallback(async () => {
    // Store the current session ID so sync() doesn't re-authenticate from the same cookie
    const result = await readClerkCookie()
    if (result?.sid) {
      await chrome.storage.local.set({ misirSignedOutSid: result.sid })
    }
    await chrome.storage.local.remove(['misirUser', 'misirToken'])
    await clearClerkToken()
    setUser(null)
    setToken(null)
  }, [])

  return { user, loading, token, signOut }
}
