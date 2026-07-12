/**
 * Backend API client for Misir Extension v2
 * Uses ky for HTTP requests with Clerk JWT auth
 */

import ky from 'ky'
import { cacheClerkToken, getCachedClerkToken } from './auth'
import { ConsentRequiredError } from '@/lib/types'
import type {
  ArtifactPayload,
  CacheResponse,
  ConsentResponse,
  CaptureApiResult,
} from '@/lib/types'

// Backend base URL comes from VITE_BACKEND_URL (see .env), defaulting to the
// local dev server. A content script / service worker can't use a relative
// Vite proxy, so this must always be an absolute origin.
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:8000'
const API_BASE = `${BACKEND_URL}/api/v1`

// Resolve a bearer token. Reads Clerk's `__session` cookie from the web app
// origin (see lib/auth.ts). NOTE: the sync-host SDK path was pulled out of the
// service worker — clerk-js references `document` and destabilised the SW
// (dropped message responses → matching stopped). Sync-host "log in once" will
// return via an offscreen-document client, which has a real DOM.
async function authToken(): Promise<string | null> {
  return getCachedClerkToken()
}

// Create ky instance with default options
const api = ky.create({
  prefixUrl: API_BASE,
  timeout: 30000,
  retry: {
    limit: 2,
    methods: ['get', 'post', 'put'],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      async (request) => {
        const token = await authToken()
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`)
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401) {
          // Token expired, clear cache
          await cacheClerkToken('')
        }
      },
    ],
  },
})

/**
 * Capture an artifact (web page or AI chat)
 */
export async function apiCapture(payload: ArtifactPayload): Promise<CaptureApiResult> {
  try {
    const response = await api.post('artifacts/capture', {
      json: payload,
    }).json<CaptureApiResult>()
    return response
  } catch (error: any) {
    if (error.response?.status === 403) {
      const data = await error.response.json().catch(() => ({}))
      throw new ConsentRequiredError(data.purpose || 'capture', data.message || 'Consent required')
    }
    throw error
  }
}

/**
 * Update engagement for an artifact
 */
export async function apiUpdateEngagement(
  remoteId: number,
  data: {
    engagement_level: string
    dwell_time_ms: number
    scroll_depth: number
    reading_depth: number
  }
): Promise<void> {
  await api.post(`artifacts/${remoteId}/engagement`, { json: data }).json()
}

/**
 * Get cached spaces, subspaces, and markers for offline matching
 */
export async function apiGetCache(): Promise<CacheResponse> {
  return api.get('cache').json<CacheResponse>()
}

/**
 * Current account — verifies the token and returns the persisted email + ids.
 */
export async function apiGetMe(): Promise<{ id: string; clerk_user_id: string; email: string }> {
  return api.get('me').json()
}

/**
 * Get user consent status
 */
export async function apiGetConsent(): Promise<ConsentResponse> {
  return api.get('me/consent').json<ConsentResponse>()
}

/**
 * Export user data (DSAR)
 */
export async function apiExportData(): Promise<any> {
  return api.get('me/export').json()
}

/**
 * Delete user account (DSAR)
 */
export async function apiDeleteAccount(): Promise<void> {
  await api.delete('me').json()
}

/**
 * Feedback loop: teach a subspace the salient terms from a page the user
 * corrected onto it, as low-weight "learned" markers.
 */
export async function apiLearnMarkers(
  spaceId: number,
  subspaceId: number,
  terms: string[],
): Promise<{ added: Array<{ id: number; label: string }> }> {
  return api
    .post(`spaces/${spaceId}/subspaces/${subspaceId}/markers/learn`, { json: { terms } })
    .json<{ added: Array<{ id: number; label: string }> }>()
}

/**
 * Sync local consent with backend
 */
export async function apiSyncConsent(consent: { webCapture: boolean; aiChatCapture: boolean }): Promise<void> {
  await api.put('me/consent', {
    json: {
      consents: [
        { purpose: 'web_capture', granted: consent.webCapture },
        { purpose: 'ai_chat_capture', granted: consent.aiChatCapture },
      ],
    },
  }).json()
}