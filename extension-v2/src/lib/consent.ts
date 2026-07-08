/**
 * Capture consent - affirmative, per-purpose, off by default
 * Ported from old extension
 */

export const POLICY_VERSION = '2026-06-07'

export interface CaptureConsent {
  webCapture: boolean
  aiChatCapture: boolean
  version?: string
  grantedAt?: number
}

const DEFAULT_CONSENT: CaptureConsent = { webCapture: false, aiChatCapture: false }
const STORAGE_KEY = 'misirConsent'

export async function getConsent(): Promise<CaptureConsent> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    return { ...DEFAULT_CONSENT, ...(result[STORAGE_KEY] || {}) }
  } catch {
    return DEFAULT_CONSENT
  }
}

export async function setConsent(patch: Partial<CaptureConsent>): Promise<CaptureConsent> {
  const current = await getConsent()
  const next: CaptureConsent = {
    ...current,
    ...patch,
    version: POLICY_VERSION,
    grantedAt: Date.now(),
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: next })
  return next
}

export async function resetConsent(): Promise<CaptureConsent> {
  await chrome.storage.local.remove(STORAGE_KEY)
  return DEFAULT_CONSENT
}

/**
 * Honor the Global Privacy Control signal (CCPA/CPRA opt-out of sale/share;
 * privacy-by-default). When present and true we suppress collection regardless
 * of stored consent.
 */
export function gpcOptOut(): boolean {
  try {
    return (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  } catch {
    return false
  }
}

/**
 * Check if consent is granted for a specific purpose, considering GPC
 */
export async function hasConsent(purpose: 'webCapture' | 'aiChatCapture'): Promise<boolean> {
  const consent = await getConsent()
  if (gpcOptOut()) return false
  return consent[purpose] === true
}