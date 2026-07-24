/**
 * Host blocklist — pages from these domains are never offered for capture.
 * Ported from the v1 extension.
 */
export const DEFAULT_BLOCKLIST: string[] = [
  // Search engines (result pages, not article content). Does NOT include
  // AI-answer engines like Perplexity — those are supported capture surfaces
  // (see host_permissions in manifest.json), not blocked.
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'search.yahoo.com',
  'yandex.ru',
  'yandex.com',
  'baidu.com',
  'ecosia.org',
  'startpage.com',
  'search.brave.com',
  'www.ask.com',
  'search.aol.com',
  'so.com',
  'sogou.com',
  // Email — dedicated webmail hosts only, not a provider's whole domain
  // (e.g. not gmx.com/icloud.com, which mix mail with other apps/marketing).
  'mail.google.com',
  'mail.yahoo.com',
  'outlook.live.com',
  'outlook.office.com',
  'mail.proton.me',
  'mail.yandex.com',
  'mail.zoho.com',
  'mail.aol.com',
  // Auth / account / SSO
  'accounts.google.com',
  'myaccount.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
  'login.yahoo.com',
  'id.atlassian.com',
  'signin.aws.amazon.com',
  'secure.login.gov',
  'login.salesforce.com',
  // Social / feeds — not Reddit or Quora, which host genuine long-form
  // reading/discussion content people research with, not just a feed.
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'tiktok.com',
  'pinterest.com',
  'threads.net',
  'snapchat.com',
  'nextdoor.com',
  'bsky.app',
  // Chat / messaging apps (conversation UI, not readable/capturable content)
  'web.whatsapp.com',
  'web.telegram.org',
  'messenger.com',
  'chat.google.com',
  'app.slack.com',
  'discord.com',
  'discordapp.com',
  'app.element.io',
  // Video meetings (participant lists / UI, never capturable content)
  'meet.google.com',
  'zoom.us',
  'teams.microsoft.com',
  'teams.live.com',
  'convay.com',
  'webex.com',
  'whereby.com',
  'meet.jit.si',
  'meet.zoho.com',
  'gotomeeting.com',
  'bluejeans.com',
  'chime.aws',
  'web.skype.com',
  // Banking / payments / crypto — secure transactional dashboards, not
  // reading content. Necessarily a representative set, not exhaustive.
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'citibank.com',
  'paypal.com',
  'venmo.com',
  'binance.com',
  'coinbase.com',
  'kraken.com',
  'robinhood.com',
  'fidelity.com',
  'schwab.com',
  'vanguard.com',
  // Password managers / 2FA vaults
  'bitwarden.com',
  'vault.bitwarden.com',
  'lastpass.com',
  '1password.com',
  'dashlane.com',
  'keepersecurity.com',
  'authy.com',
  // Cloud / admin / SaaS dashboards — the specific app subdomain only, not
  // a vendor's whole domain (e.g. not stripe.com or aws.amazon.com, which
  // have real docs/marketing content worth capturing).
  'dashboard.clerk.com',
  'admin.cloud.microsoft',
  'console.aws.amazon.com',
  'portal.azure.com',
  'console.cloud.google.com',
  'dashboard.stripe.com',
  'app.datadoghq.com',
  'admin.shopify.com',
  'app.hubspot.com',
  'analytics.google.com',
  'ads.google.com',
  'business.facebook.com',
  'app.mixpanel.com',
  'app.amplitude.com',
  'app.intercom.com',
  'www.semrush.com',
  'app.semrush.com',
  'www.canva.com',
  'trello.com',
  'app.asana.com',
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
