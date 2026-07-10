/**
 * Host blocklist — pages from these domains are never offered for capture.
 * Ported from the v1 extension.
 */
export const DEFAULT_BLOCKLIST: string[] = [
  // Search engines
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'search.yahoo.com',
  'yandex.ru',
  // Email
  'mail.google.com',
  'mail.yahoo.com',
  'outlook.live.com',
  'outlook.office.com',
  // Auth
  'accounts.google.com',
  'login.microsoftonline.com',
  // Social / feeds
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  // Video meetings (participant lists / UI, never capturable content)
  'meet.google.com',
  'zoom.us',
  'teams.microsoft.com',
  'teams.live.com',
  'convay.com',
  'webex.com',
  'whereby.com',
  'meet.jit.si',
  // Misir app itself
  'localhost',
  'misir.app',
]

const STORAGE_KEY = 'misirBlocklist'

export async function getBlocklist(): Promise<string[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    return (result[STORAGE_KEY] as string[] | undefined) ?? DEFAULT_BLOCKLIST
  } catch {
    return DEFAULT_BLOCKLIST
  }
}

export async function setBlocklist(list: string[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: list })
}

export function normalizeDomain(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

export function isHostBlocked(hostname: string, blocklist: string[]): boolean {
  const h = hostname.toLowerCase()
  return blocklist.some((entry) => {
    const e = entry.toLowerCase()
    return h === e || h.endsWith('.' + e)
  })
}
