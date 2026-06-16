/**
 * Capture consent — affirmative, per-purpose, off by default.
 *
 * No content is captured unless the user has explicitly granted the matching
 * purpose here (GDPR Art 6 / ePrivacy Art 5(3) / CCPA opt-in / BD PDPO). The
 * backend independently re-checks consent, so this is the client-side half of
 * a defence-in-depth gate.
 */
export const POLICY_VERSION = '2026-06-07'

export interface CaptureConsent {
  webCapture: boolean
  aiChatCapture: boolean
  version?: string
  grantedAt?: number
}

const DEFAULT_CONSENT: CaptureConsent = { webCapture: false, aiChatCapture: false }

export async function getConsent(): Promise<CaptureConsent> {
  try {
    const { misirConsent } = await chrome.storage.local.get('misirConsent')
    return { ...DEFAULT_CONSENT, ...(misirConsent || {}) }
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
  await chrome.storage.local.set({ misirConsent: next })
  return next
}

/**
 * Honor the Global Privacy Control signal (CCPA/CPRA opt-out of sale/share;
 * privacy-by-default). When present and true we suppress collection regardless
 * of stored consent. Read from the page's navigator (shared with the content
 * script's isolated world).
 */
export function gpcOptOut(): boolean {
  try {
    return (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  } catch {
    return false
  }
}
