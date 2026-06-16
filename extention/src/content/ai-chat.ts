import { createConsola } from 'consola'
import { getAdapter, INJECT_WEB_HOSTS, AI_CHAT_HOSTS } from '@/adapters'
import { getConsent, gpcOptOut } from '@/lib/consent'
import { chatCaptureToText } from '@/types/chat'
import { EngagementTracker } from './engagement'
import type { CaptureAIChatMessage, InjectWebAuthData } from '@/types/chat'
import type { CaptureResultMessage, UpdateEngagementMessage } from '@/types'

const log = createConsola({ level: 4 }).withTag('ai-chat')

// When context is invalidated the extension was reloaded while this tab was open.
// chrome.runtime.* calls throw synchronously (not a rejected promise), so all chrome
// API usage must be inside try/catch from here on. We set a flag to stop all activity.
let contextDead = false

async function sendMessageWithRetry<T = CaptureResultMessage>(
  message: CaptureAIChatMessage | UpdateEngagementMessage,
  maxRetries = 3,
  baseDelayMs = 500,
): Promise<T | undefined> {
  if (contextDead) return undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await chrome.runtime.sendMessage(message)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (errorMsg.includes('context invalidated')) { contextDead = true; return undefined }
      const isSwNotReady = errorMsg.includes('receiving end does not exist')
      if (!isSwNotReady || attempt === maxRetries) throw err
      const delay = baseDelayMs * Math.pow(2, attempt)
      log.debug(`SW not ready, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

// Forward all log levels to background so they appear in the popup debug panel.
// Must be try/catch — chrome.runtime.sendMessage throws synchronously when context is dead.
function relay(level: string, args: unknown[]): void {
  if (contextDead) return
  try {
    const text = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
    chrome.runtime.sendMessage({ type: 'DEBUG_LOG', message: `[${level}] ${text}` }).catch(() => {})
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

// Log on startup to verify script loaded
const startupAdapter = getAdapter(location.href)
if (startupAdapter) {
  log.debug(`[${startupAdapter.platform.toUpperCase()}] Content script loaded`)
}

// ── inject-web ─────────────────────────────────────────────────────────────

let injectWebReady = false

function injectScript(): void {
  if (injectWebReady || contextDead) return
  try {
    const s = document.createElement('script')
    s.src = chrome.runtime.getURL('inject-web.js')
    s.onload = () => { injectWebReady = true }
    ;(document.head ?? document.documentElement).prepend(s)
  } catch { contextDead = true }
}

function getAuthFromPage(platform: string): Promise<InjectWebAuthData | null> {
  return new Promise((resolve) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler)
      resolve(null)
    }, 3000)

    function handler(event: MessageEvent) {
      if (
        event.source !== window ||
        event.data?.type !== 'MISIR_AUTH_RESPONSE' ||
        event.data?.requestId !== requestId
      ) return
      clearTimeout(timer)
      window.removeEventListener('message', handler)
      resolve(event.data.data ?? null)
    }

    window.addEventListener('message', handler)
    window.postMessage({ type: 'MISIR_GET_AUTH', platform, requestId }, '*')
  })
}

// ── SHA-256 for content hash ───────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── SPA URL change detection ───────────────────────────────────────────────

function watchUrlChanges(callback: () => void): void {
  // Wrap callback so errors from our code never propagate into the host page's
  // pushState callers (would surface as anonymous errors in ChatGPT etc.)
  const safe = () => { try { callback() } catch (err) { log.error('URL change handler:', err) } }

  const orig = { push: history.pushState.bind(history), replace: history.replaceState.bind(history) }
  history.pushState = (...args) => { orig.push(...args); safe() }
  history.replaceState = (...args) => { orig.replace(...args); safe() }
  window.addEventListener('popstate', safe)

  let lastHref = location.href
  setInterval(() => {
    if (location.href !== lastHref) { lastHref = location.href; safe() }
  }, 500)
}

// ── Capture ────────────────────────────────────────────────────────────────

let captureTimer: ReturnType<typeof setTimeout> | null = null
let lastCapturedId: string | null = null
let activeTracker: EngagementTracker | null = null
let activeRemoteId: number | null = null
let currentObserver: MutationObserver | null = null

function sendEngagement(): void {
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
}

async function tryCapture(authRetry = 0, fetchRetry = 0): Promise<void> {
  // Consent gate: no AI-chat capture unless explicitly granted (default off),
  // and never when Global Privacy Control is signalled.
  const consent = await getConsent()
  if (!consent.aiChatCapture) return
  if (gpcOptOut()) { log.debug('GPC set — AI-chat capture suppressed'); return }

  const { misirAIChatCapture } = await chrome.storage.local.get(['misirAIChatCapture'])
  if (misirAIChatCapture === false) return

  const adapter = getAdapter(location.href)
  if (!adapter) return

  const conversationId = adapter.getConversationId(location.href)
  if (!conversationId || conversationId === lastCapturedId) return

  log.debug(`tryCapture START: ${adapter.platform} (conv: ${conversationId}, retry: ${fetchRetry})`)

  let auth: InjectWebAuthData | undefined
  if (adapter.needsInjectWeb) {
    const data = await getAuthFromPage(adapter.platform)
    log.debug(`Auth data fetched: ${!!data?.authorization ? 'found' : 'not found'}`)
    if (!data?.authorization) {
      // Auth not captured yet — retry with backoff (up to ~2 min total) waiting
      // for ChatGPT to make an API call that our hook can intercept
      if (authRetry < 8) {
        const delay = Math.min(5000 * (authRetry + 1), 30000)
        setTimeout(() => tryCapture(authRetry + 1).catch(() => {}), delay)
        log.debug(`Auth not ready for ${adapter.platform}, retrying in ${delay / 1000}s (attempt ${authRetry + 1})`)
      }
      return
    }
    auth = data
  }

  log.debug(`Fetching conversation from ${adapter.platform}...`)

  const capture = await adapter.fetchConversation(conversationId, auth)
  
  log.debug(`Fetch result: ${capture ? capture.messages.length + ' messages' : 'empty'}`)
  
  if (!capture || capture.messages.length === 0) {
    log.debug(`No messages yet (retry ${fetchRetry + 1}/12)...`)
    // Conversation not persisted yet (still streaming) — retry with smart backoff
    if (fetchRetry < 12) {
      // Intelligent retry: shorter delays at first, longer later
      // Retries: 1s, 2s, 3s, 5s, 8s, 13s, 20s, 30s... (Fibonacci-like)
      const delays = [1000, 2000, 3000, 5000, 8000, 13000, 20000, 30000, 40000, 50000, 60000, 60000]
      const delay = delays[fetchRetry] || 60000
      setTimeout(() => tryCapture(0, fetchRetry + 1).catch(() => {}), delay)
    }
    return
  }

  // Check if we have a real exchange (user + assistant), not just user waiting for response
  if (capture.messages.length === 1 && capture.messages[0].role === 'user') {
    // Only user message, no assistant response yet - retry more aggressively
    if (fetchRetry < 12) {
      const delays = [500, 1000, 2000, 3000, 5000, 8000, 13000, 20000, 30000, 40000, 50000, 60000]
      const delay = delays[fetchRetry] || 60000
      setTimeout(() => tryCapture(0, fetchRetry + 1).catch(() => {}), delay)
    }
    return
  }

  const text = chatCaptureToText(capture)
  const contentHash = await sha256(text)
  const wordCount = text.split(/\s+/).filter(Boolean).length

  const message: CaptureAIChatMessage = {
    type: 'CAPTURE_AI_CHAT',
    capture,
    normalizedUrl: location.href,
    domain: location.hostname,
    contentHash,
    wordCount,
  }

  log.debug(`Sending to background: ${wordCount} words, hash: ${contentHash.slice(0, 8)}...`)

  const result: CaptureResultMessage | undefined = await sendMessageWithRetry<CaptureResultMessage>(message)

  log.debug(`Background response: matched=${result?.matched}, remoteId=${result?.remoteId}`)

  if (result?.matched && result.remoteId) {
    lastCapturedId = conversationId  // only lock after a confirmed save
    activeTracker?.destroy()
    activeTracker = new EngagementTracker(wordCount)
    activeRemoteId = result.remoteId
    log.info(`Captured ${capture.platform} — "${capture.title}" (${capture.messages.length} turns) → ${result.subspaceName}`)
  }
}

function scheduleCapture(delay = 2000): void {
  if (captureTimer) clearTimeout(captureTimer)
  captureTimer = setTimeout(() => {
    tryCapture(0).catch((err) => log.error('Capture failed:', err))
  }, delay)
}

// ── Observer ───────────────────────────────────────────────────────────────

function setupObserver(): void {
  currentObserver?.disconnect()
  const adapter = getAdapter(location.href)
  if (!adapter) { currentObserver = null; return }

  // Try to find the specific trigger element, fall back to document.body
  const target = document.querySelector(adapter.triggerSelector) ?? document.body
  
  currentObserver = new MutationObserver(() => scheduleCapture())
  currentObserver.observe(target, { childList: true, subtree: true, characterData: false })
}

// ── Tab visibility tracking ────────────────────────────────────────────────

// When switching back to this tab, trigger capture immediately
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    log.debug('Tab became visible, checking for new messages')
    scheduleCapture(500) // Quick check after tab switch
  }
})

// Also try capture when user is active (mouse/keyboard) after tab switch
document.addEventListener('mousedown', () => scheduleCapture(1500), { once: false, capture: true })
document.addEventListener('keydown', () => scheduleCapture(1500), { once: false, capture: true })

// ── Init ───────────────────────────────────────────────────────────────────

// Inject the page-world script for platforms that need header interception
if (INJECT_WEB_HOSTS.has(location.hostname)) {
  injectScript()
}

setupObserver()

// Try capture immediately for all platforms (MutationObserver will handle updates)
if (startupAdapter) {
  scheduleCapture(500)
}

// Re-setup observer on SPA navigation — flush engagement for old conversation first
watchUrlChanges(() => {
  sendEngagement()
  lastCapturedId = null
  setupObserver()
  scheduleCapture(1500)  // Capture after nav delay for SPA to load content
})

// Send engagement when user hides or leaves the tab
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sendEngagement()
})
window.addEventListener('pagehide', sendEngagement, { once: true })

log.debug('[READY]')
