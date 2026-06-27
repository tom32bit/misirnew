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
  // Misir app itself — never capture the dashboard as research content
  'localhost',
  'misir.app',
]

const STORAGE_KEY = 'blocklist'

export async function getBlocklist(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as string[] | undefined) ?? DEFAULT_BLOCKLIST
}

export async function setBlocklist(list: string[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: list })
}

export function isHostBlocked(hostname: string, blocklist: string[]): boolean {
  const h = hostname.toLowerCase()
  return blocklist.some((entry) => {
    const e = entry.toLowerCase()
    return h === e || h.endsWith('.' + e)
  })
}
