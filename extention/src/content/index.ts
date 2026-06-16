import { createConsola } from 'consola'
import { extractPageContent } from '@/lib/capture'
import { AI_CHAT_HOSTS } from '@/adapters'
import { getBlocklist, isHostBlocked } from '@/lib/blocklist'
import { getConsent, gpcOptOut } from '@/lib/consent'
import { EngagementTracker } from './engagement'
import type { CapturePageMessage, CaptureResultMessage, UpdateEngagementMessage } from '@/types'

const log = createConsola({ level: 4 }).withTag('content')

let contextDead = false

// Forward all log levels to the background so they appear in the popup debug panel.
// Mirrors the relay pattern in ai-chat.ts — must be try/catch because
// chrome.runtime.sendMessage throws synchronously when the context is invalidated.
function relay(level: string, args: unknown[]): void {
  if (contextDead) return
  try {
    const text = args.map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`
      // Chrome runtime errors have a non-enumerable `message` — JSON.stringify gives {}
      if (typeof a === 'object' && a !== null) {
        const msg = (a as any).message
        return msg ? `Error: ${msg}` : JSON.stringify(a)
      }
      return String(a)
    }).join(' ')
    chrome.runtime.sendMessage({ type: 'DEBUG_LOG', message: `[content:${level}] ${text}` }).catch(() => {})
  } catch {
    contextDead = true
  }
}

const _d = log.debug.bind(log), _i = log.info.bind(log)
const _w = log.warn.bind(log),  _e = log.error.bind(log)
log.debug = (...a: unknown[]) => { _d(...a); relay('DBG', a) }
log.info  = (...a: unknown[]) => { _i(...a); relay('INF', a) }
log.warn  = (...a: unknown[]) => { _w(...a); relay('WRN', a) }
log.error = (...a: unknown[]) => { _e(...a); relay('ERR', a) }

async function sendMessageWithRetry(
  message: CapturePageMessage | UpdateEngagementMessage,
  maxRetries = 3,
  baseDelayMs = 500,
): Promise<CaptureResultMessage | undefined> {
  if (contextDead) return undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await chrome.runtime.sendMessage(message)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (errorMsg.includes('context invalidated')) { contextDead = true; return undefined }
      const isSwNotReady = errorMsg.includes('receiving end does not exist')
      if (!isSwNotReady) throw err
      if (attempt === maxRetries) {
        log.debug('SW not ready after all retries — skipping')
        return undefined
      }
      const delay = baseDelayMs * Math.pow(2, attempt)
      log.debug(`SW not ready, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

// ── Module-level engagement state ─────────────────────────────────────────────
// Kept at module scope so SPA navigations can flush the previous page's tracker
// before starting a new one, and so event listeners registered once at the
// bottom don't hold stale closure references.

let activeTracker: EngagementTracker | null = null
let activeRemoteId: number | null = null

function flushEngagement(): void {
  if (!activeTracker || activeRemoteId === null) return
  const snap = activeTracker.snapshot()
  const msg: UpdateEngagementMessage = {
    type: 'UPDATE_ENGAGEMENT',
    remoteId: activeRemoteId,
    ...snap,
  }
  sendMessageWithRetry(msg).catch(() => {})
  activeTracker.destroy()
  activeTracker = null
  activeRemoteId = null
}

// ── Capture ────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  // AI chat pages are handled by ai-chat.ts — skip Readability here
  if (AI_CHAT_HOSTS.has(location.hostname)) return

  // Consent gate: no capture unless the user explicitly granted web capture
  // (default off), and never when Global Privacy Control is signalled.
  const consent = await getConsent()
  if (!consent.webCapture) return
  if (gpcOptOut()) { log.debug('GPC set — capture suppressed'); return }

  const { misirAutoCapture } = await chrome.storage.local.get(['misirAutoCapture'])
  if (misirAutoCapture === false) return

  const blocklist = await getBlocklist()
  if (isHostBlocked(location.hostname, blocklist)) return

  let content
  try {
    content = await extractPageContent(document, location.href)
  } catch (err) {
    log.debug('Readability parse error (skipping):', err instanceof Error ? err.message : String(err))
    return
  }
  if (!content) {
    log.debug('Readability: no extractable content on', location.href)
    return
  }

  const message: CapturePageMessage = {
    type: 'CAPTURE_PAGE',
    url: content.url,
    title: content.title,
    textContent: content.textContent,
    wordCount: content.wordCount,
    normalizedUrl: content.normalizedUrl,
    domain: content.domain,
    contentHash: content.contentHash,
  }

  const result: CaptureResultMessage | undefined = await sendMessageWithRetry(message)

  if (!result?.matched || !result.remoteId) return

  log.info(`Matched → ${result.spaceName} / ${result.subspaceName} (${((result.confidence ?? 0) * 100).toFixed(0)}%)`)

  // Start tracking engagement for this page
  activeTracker?.destroy()
  activeTracker = new EngagementTracker(content.wordCount)
  activeRemoteId = result.remoteId
}

// ── SPA navigation detection ───────────────────────────────────────────────────
// Modern sites (YouTube, Reddit, Medium, GitHub …) are SPAs: the URL changes
// without a full page reload, so the content script is NOT re-injected.
// We monkey-patch history and poll as a fallback to detect every navigation.

function watchUrlChanges(callback: () => void): void {
  const safe = () => { try { callback() } catch (err) { log.error('URL change handler:', err) } }

  const origPush = history.pushState.bind(history)
  const origReplace = history.replaceState.bind(history)
  history.pushState = (...args) => { origPush(...args); safe() }
  history.replaceState = (...args) => { origReplace(...args); safe() }
  window.addEventListener('popstate', safe)

  // Fallback poll for frameworks that bypass history API (hash routing, etc.)
  let lastHref = location.href
  setInterval(() => {
    if (location.href !== lastHref) { lastHref = location.href; safe() }
  }, 500)
}

let runTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRun(delay = 1500): void {
  if (runTimer) clearTimeout(runTimer)
  runTimer = setTimeout(() => {
    run().catch((err) => log.error('Content script error:', err))
  }, delay)
}

// ── Init ───────────────────────────────────────────────────────────────────────

log.debug(`[READY] ${location.href}`)

// Initial capture on page load
run().catch((err) => log.error('Content script error:', err))

// Re-capture on every SPA navigation: flush engagement for the old page first,
// then schedule a capture after the new page has had time to render its content.
watchUrlChanges(() => {
  log.debug(`[NAV] ${location.href}`)
  flushEngagement()
  scheduleRun(1500)
})

// Flush engagement when user hides or leaves the tab (registered once)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushEngagement()
})
window.addEventListener('pagehide', flushEngagement, { once: true })

// ── Engagement snapshot query (for popup debug panel) ─────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_ENGAGEMENT_SNAPSHOT') {
    sendResponse({
      snapshot: activeTracker?.snapshot() ?? null,
      remoteId: activeRemoteId,
      url: location.href,
    })
    return false
  }
})
