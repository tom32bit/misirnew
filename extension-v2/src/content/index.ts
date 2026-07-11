/**
 * Content Script Entry Point
 * - Detects platform
 * - Injects toolbar for AI chat platforms
 * - Handles web page capture on demand
 * - Listens for messages from background
 */

import { createConsola } from 'consola'
import { initToolbar, showToolbar, hideToolbar, setToolbarSaving, setToolbarOutcome, setToolbarPreview, setToolbarChecking, clearToolbarOutcome, resetToolbarSaveState, destroyToolbar, type SaveOutcome, type MatchPreview } from './toolbar'
import { extractPageContent } from './web-capture'
import { extractConversation, getExtractor } from './extractors'
import { detectPlatform } from './platform-detector'
import { sha256 } from '@/lib/utils'
import { getConsent, gpcOptOut } from '@/lib/consent'
import { getBlocklist, isHostBlocked } from '@/lib/blocklist'
import { EngagementTracker } from './engagement'
import type { CapturePageMessage, CaptureAIChatMessage, CaptureResultMessage, TabState } from '@/lib/types'

const log = createConsola({ level: 4 }).withTag('content')

// 'aichat' → a supported AI chat platform (DOM extractor); 'web' → an ordinary
// article/page (Readability); null → don't offer capture here.
type PageMode = 'aichat' | 'web' | null

let contextDead = false
let currentMode: PageMode = null

// Measures attention (dwell time, scroll depth, reading depth, engagement stage)
// from page load, so a skimmed page and a deeply-read one aren't weighted alike.
const engagement = new EngagementTracker(0)

function pageMode(): PageMode {
  if (detectPlatform(window.location.href)) return 'aichat'
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return null
  // Don't offer capture on the Misir app itself.
  const host = location.hostname
  if (host === 'misir.app' || host === 'api.misir.app') return null
  if (host === 'localhost' && location.port === '3000') return null
  return 'web'
}

// Effective mode after honouring the user's settings: the master pause toggles
// (Settings › Capture) and the blocked-sites list. Returns null → hide the card.
async function resolveMode(): Promise<PageMode> {
  const base = pageMode()
  if (!base) return null
  try {
    const { misirWebEnabled, misirAiEnabled } = await chrome.storage.local.get([
      'misirWebEnabled',
      'misirAiEnabled',
    ])
    if (base === 'aichat') {
      return misirAiEnabled === false ? null : 'aichat'
    }
    // web
    if (misirWebEnabled === false) return null
    const blocklist = await getBlocklist()
    if (isHostBlocked(window.location.hostname, blocklist)) return null
    return 'web'
  } catch {
    return base
  }
}

// ── Safe chrome.runtime.sendMessage with retry ───────────────────────────────

async function sendMessageWithRetry<T = any>(
  message: any,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<T | undefined> {
  if (contextDead) return undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await chrome.runtime.sendMessage(message)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (errorMsg.includes('context invalidated') || errorMsg.includes('Extension context invalidated')) {
        contextDead = true
        return undefined
      }
      const isSwNotReady = errorMsg.includes('receiving end does not exist')
      if (!isSwNotReady || attempt === maxRetries) throw err

      const delay = baseDelayMs * Math.pow(2, attempt)
      log.debug(`SW not ready, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

// ── Platform detection & toolbar ────────────────────────────────────────────

let lastActiveHref = ''

async function checkPlatform(): Promise<void> {
  const mode = await resolveMode()
  const was = currentMode
  currentMode = mode

  // Genuine navigation (new page or conversation) → forget the previous page's
  // saved state so the card starts fresh rather than showing "Saved" / offering
  // to continue a chat that's no longer on screen.
  if (window.location.href !== lastActiveHref) {
    lastActiveHref = window.location.href
    savedTextLength = null
    lastSavedOutcome = null
    continuationPending = false
    lastPreview = null
    matchComputed = false
    resetToolbarSaveState()
  }

  if (mode && !was) {
    log.debug(`Misir active (${mode})`)
    initToolbar(handleSaveClick, handleCorrect)
    showToolbar()
    // Only AI chats stream in new content that needs live re-matching; a static
    // web page is previewed once per navigation.
    if (mode === 'aichat') startConversationObserver()
  } else if (!mode && was) {
    log.debug('Not a capturable page — hiding card')
    hideToolbar()
  }

  if (mode) {
    // A new URL usually means new content — force the next preview. Web pages
    // are ready at document_idle, so preview almost immediately; AI chats need a
    // moment for the SPA to render the conversation.
    lastPreviewHash = null
    schedulePreview(mode === 'aichat' ? 1200 : 200)
  } else {
    setToolbarPreview(null)
  }
}

// ── Live match preview (before the user clicks save) ─────────────────────────
// Re-extracts the visible conversation as it grows and asks the background for a
// non-saving match, so the pill can show the best space + score up front. This
// also makes the pill react to a freshly started chat without a manual refresh.

let previewTimer: ReturnType<typeof setTimeout> | null = null
let conversationObserver: MutationObserver | null = null
let lastPreviewHash: string | null = null

// Mirrored UI state, exposed to the popup via GET_TAB_STATE so it can show a
// read-only view of exactly what the in-page toolbar is showing right now.
let lastPreview: MatchPreview | null = null
let lastSavedOutcome: SaveOutcome | null = null
let continuationPending = false
let checkingState = false
// Whether a match has actually been computed for the current page yet. Lets the
// popup tell "still working / couldn't read the page" apart from a real "no
// match" — a null lastPreview alone can't distinguish the two.
let matchComputed = false

// Track the "checking" flag locally in addition to pushing it to the toolbar, so
// GET_TAB_STATE can report it.
function setChecking(next: boolean): void {
  checkingState = next
  setToolbarChecking(next)
}

// Read-only snapshot for the popup. Derives the same state the toolbar renders.
function getTabState(): TabState {
  const base = {
    capturable: currentMode != null,
    mode: currentMode,
    title: document.title || location.hostname,
    domain: location.hostname,
    url: location.href,
  }
  if (currentMode == null) return { ...base, kind: 'inactive' }
  if (gpcOptOut()) return { ...base, kind: 'gpc' }
  if (lastSavedOutcome) {
    return { ...base, kind: continuationPending ? 'saved-continuation' : 'saved', saved: lastSavedOutcome }
  }
  if (lastPreview?.confidence != null) return { ...base, kind: 'match', match: lastPreview }
  // Only call it a real "no match" once a match has actually run; until then the
  // preview is still being computed (or the page/chat wasn't readable yet).
  if (checkingState || !matchComputed) return { ...base, kind: 'checking' }
  return { ...base, kind: 'nomatch' }
}

// Ensure the popup gets a freshly computed match rather than a stale/premature
// snapshot: if this is a capturable page that hasn't been matched yet, run the
// preview now and then report.
async function ensureFreshTabState(): Promise<TabState> {
  if (currentMode && !gpcOptOut() && !lastSavedOutcome && !matchComputed) {
    lastPreviewHash = null
    await refreshPreview()
  }
  return getTabState()
}

// Length of the text captured by the last successful save on this page. When the
// visible content grows meaningfully past it, the conversation/page continued —
// so we drop the "Saved" state and re-offer capture. null = nothing saved yet.
let savedTextLength: number | null = null
const CONTINUATION_MIN_CHARS = 80

function conversationText(): string | null {
  const extractor = getExtractor(window.location.href)
  if (!extractor) return null
  const conversationId = extractor.getConversationId(window.location.href)
  if (!conversationId) return null
  const messages = extractor.extractFromDOM()
  if (messages.length === 0) return null
  return messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
}

// A web page needs at least this much readable text before we try to match it.
// Canvas apps (Excalidraw, Figma), app shells, and blank pages expose only UI
// chrome to Readability — matching that produces meaningless results.
const MIN_WEB_WORDS = 60

// Text used to compute the live match preview — the conversation on AI chats,
// the Readability article on web pages.
async function previewText(): Promise<string | null> {
  if (currentMode === 'aichat') return conversationText()
  if (currentMode === 'web') {
    try {
      const content = await extractPageContent(document, window.location.href)
      if (!content || content.wordCount < MIN_WEB_WORDS) return null
      return content.textContent
    } catch {
      return null
    }
  }
  return null
}

async function refreshPreview(): Promise<void> {
  if (contextDead || !currentMode) { setChecking(false); lastPreview = null; setToolbarPreview(null); return }
  if (gpcOptOut()) { setChecking(false); lastPreview = null; setToolbarPreview(null); return }

  // On web pages, extracting the article (Readability) takes a beat — show a
  // "Checking…" state up front so the card isn't blank on load.
  if (currentMode === 'web') setChecking(true)

  const text = await previewText()
  if (!text) { setChecking(false); lastPreview = null; setToolbarPreview(null); return }

  // "Capture further": if we've already saved this page/chat and the visible
  // content has since grown, the conversation (or article) continued — clear the
  // persistent "Saved" state so the card offers to capture the continuation.
  // If it hasn't grown, keep showing "Saved" and skip the match query entirely.
  if (savedTextLength != null) {
    if (text.length > savedTextLength + CONTINUATION_MIN_CHARS) {
      continuationPending = true
      clearToolbarOutcome()
    } else {
      setChecking(false)
      return
    }
  }

  // Skip re-querying if the content hasn't materially changed.
  const hash = `${text.length}:${text.slice(0, 48)}:${text.slice(-48)}`
  if (hash === lastPreviewHash) { setChecking(false); return }
  lastPreviewHash = hash

  try {
    const result = await sendMessageWithRetry<CaptureResultMessage>({ type: 'PREVIEW_MATCH', text })
    lastPreview = result?.matched
      ? { spaceName: result.spaceName, subspaceName: result.subspaceName, confidence: result.confidence }
      : null
    setToolbarPreview(lastPreview)
    matchComputed = true
  } catch (err) {
    log.debug('Preview match failed:', err instanceof Error ? err.message : String(err))
  } finally {
    setChecking(false)
  }
}

function schedulePreview(delay = 800): void {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    refreshPreview().catch((err) => log.error('Preview error:', err))
  }, delay)
}

// Watch the page for new/streamed messages; the observer lives on document.body,
// which survives SPA navigation, so one instance covers the whole session.
function startConversationObserver(): void {
  if (conversationObserver || !document.body) return
  conversationObserver = new MutationObserver(() => schedulePreview())
  conversationObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
}

// Reflect the backend's result in the card.
function reportOutcome(result: CaptureResultMessage | undefined, what: string): void {
  if (result?.matched) {
    lastSavedOutcome = {
      status: 'saved',
      spaceName: result.spaceName,
      subspaceName: result.subspaceName,
      confidence: result.confidence,
    }
    continuationPending = false
    setToolbarOutcome(lastSavedOutcome)
    log.info(
      `Saved ${what} → ${result.spaceName ?? '?'} (${Math.round((result.confidence ?? 0) * 100)}% match)`,
    )
  } else {
    setToolbarOutcome({ status: 'nomatch' })
    log.debug(`${what} not matched to any space`)
  }
}

async function handleSaveClick(): Promise<void> {
  if (contextDead) return
  if (gpcOptOut()) { log.debug('GPC set — capture suppressed'); return }
  if (currentMode === 'aichat') return saveAIChat()
  if (currentMode === 'web') return saveWebPage()
}

async function saveAIChat(): Promise<void> {
  const consent = await getConsent()
  if (!consent.aiChatCapture) {
    log.debug('AI chat capture consent not granted')
    await sendMessageWithRetry({ type: 'CONSENT_NEEDED', purpose: 'ai_chat_capture' })
    return
  }

  const extractor = getExtractor(window.location.href)
  if (!extractor) {
    log.warn('No extractor found for current platform')
    return
  }

  setToolbarSaving(true)
  try {
    const conversation = await extractConversation(window.location.href)
    if (!conversation || conversation.messages.length === 0) {
      log.warn('No messages extracted from conversation')
      return
    }

    const text = conversation.messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const wordCount = text.split(/\s+/).filter(Boolean).length
    engagement.setWordCount(wordCount)
    const message: CaptureAIChatMessage = {
      type: 'CAPTURE_AI_CHAT',
      capture: conversation,
      normalizedUrl: conversation.url,
      domain: new URL(conversation.url).hostname,
      contentHash: await sha256(text),
      wordCount,
      ...engagement.snapshot(),
    }

    const result = await sendMessageWithRetry<CaptureResultMessage>(message)
    reportOutcome(result, `${conversation.platform} conversation`)
    if (result?.matched) savedTextLength = text.length
  } catch (err) {
    log.error('Save failed:', err)
  } finally {
    setToolbarSaving(false)
  }
}

async function saveWebPage(): Promise<void> {
  const consent = await getConsent()
  if (!consent.webCapture) {
    log.debug('Web capture consent not granted')
    await sendMessageWithRetry({ type: 'CONSENT_NEEDED', purpose: 'web_capture' })
    return
  }

  setToolbarSaving(true)
  try {
    const pageContent = await extractPageContent(document, window.location.href)
    if (!pageContent || pageContent.wordCount < MIN_WEB_WORDS) {
      log.debug('Not enough readable content to capture')
      setToolbarOutcome({ status: 'nomatch' })
      return
    }

    engagement.setWordCount(pageContent.wordCount)
    const message: CapturePageMessage = {
      type: 'CAPTURE_PAGE',
      url: pageContent.url,
      normalizedUrl: pageContent.normalizedUrl,
      domain: pageContent.domain,
      title: pageContent.title,
      textContent: pageContent.textContent,
      contentHash: pageContent.contentHash,
      wordCount: pageContent.wordCount,
      ...engagement.snapshot(),
    }

    const result = await sendMessageWithRetry<CaptureResultMessage>(message)
    reportOutcome(result, 'web page')
    if (result?.matched) savedTextLength = pageContent.textContent.length
  } catch (err) {
    log.error('Web capture failed:', err)
  } finally {
    setToolbarSaving(false)
  }
}

// ── Match correction ─────────────────────────────────────────────────────────
// The user picked the correct space·subspace in the toolbar. Gather the same
// content a save would, and send it as a correction — the background saves it
// there AND teaches that subspace this page's vocabulary (learned markers).
async function handleCorrect(spaceId: number, subspaceId: number): Promise<void> {
  if (contextDead || gpcOptOut()) return
  setToolbarSaving(true)
  try {
    if (currentMode === 'aichat') {
      const conversation = await extractConversation(window.location.href)
      if (!conversation || conversation.messages.length === 0) return
      const text = conversation.messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n')
      const wordCount = text.split(/\s+/).filter(Boolean).length
      engagement.setWordCount(wordCount)
      const result = await sendMessageWithRetry<CaptureResultMessage>({
        type: 'CORRECT_MATCH', text, spaceId, subspaceId,
        url: conversation.url, normalizedUrl: conversation.url,
        domain: new URL(conversation.url).hostname, title: conversation.title,
        contentHash: await sha256(text), wordCount,
        contentSource: 'ai_chat', platform: conversation.platform,
        ...engagement.snapshot(),
      })
      reportOutcome(result, 'correction')
      if (result?.matched) savedTextLength = text.length
    } else if (currentMode === 'web') {
      const pageContent = await extractPageContent(document, window.location.href)
      if (!pageContent || pageContent.wordCount < MIN_WEB_WORDS) return
      engagement.setWordCount(pageContent.wordCount)
      const result = await sendMessageWithRetry<CaptureResultMessage>({
        type: 'CORRECT_MATCH', text: pageContent.textContent, spaceId, subspaceId,
        url: pageContent.url, normalizedUrl: pageContent.normalizedUrl,
        domain: pageContent.domain, title: pageContent.title,
        contentHash: pageContent.contentHash, wordCount: pageContent.wordCount,
        contentSource: 'web', platform: 'web',
        ...engagement.snapshot(),
      })
      reportOutcome(result, 'correction')
      if (result?.matched) savedTextLength = pageContent.textContent.length
    }
  } catch (err) {
    log.error('Correction failed:', err)
  } finally {
    setToolbarSaving(false)
  }
}

// ── Message listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CAPTURE_PAGE') {
    // "Save Page" from the popup/sidepanel — only meaningful on an ordinary page.
    if (currentMode === 'web') {
      saveWebPage().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }))
      return true
    }
    sendResponse({ ok: false })
    return true
  }

  if (message.type === 'GET_DEBUG_INFO') {
    sendResponse({
      mode: currentMode,
      url: window.location.href,
      contextDead,
    })
    return true
  }

  // Read-only snapshot for the popup — mirrors the in-page toolbar. Forces a
  // fresh match first so the popup never shows a premature "no match".
  if (message.type === 'GET_TAB_STATE') {
    ensureFreshTabState()
      .then((s) => sendResponse(s))
      .catch(() => sendResponse(getTabState()))
    return true
  }

  // The popup's "Save the continuation" action. Only meaningful once this page/
  // chat has already been saved this session (savedTextLength set) and has since
  // grown — the initial save still goes through the in-page toolbar (which shows
  // the consent warning for chats). Consent was granted on that first save, so
  // the continuation saves directly. Replies with the fresh tab state.
  if (message.type === 'TRIGGER_SAVE') {
    handleSaveClick()
      .then(() => sendResponse({ ok: true, state: getTabState() }))
      .catch((err) => { log.error('Popup-triggered save failed:', err); sendResponse({ ok: false, state: getTabState() }) })
    return true
  }

  return false
})

// ── SPA navigation handling ──────────────────────────────────────────────────

let lastHref = window.location.href

function watchUrlChanges(): void {
  const safeCheck = () => {
    checkPlatform().catch((err) => log.error('URL change handler error:', err))
  }

  const origPush = history.pushState.bind(history)
  const origReplace = history.replaceState.bind(history)

  history.pushState = (...args) => {
    origPush(...args)
    safeCheck()
  }

  history.replaceState = (...args) => {
    origReplace(...args)
    safeCheck()
  }

  window.addEventListener('popstate', safeCheck)

  // Polling fallback for hash changes etc.
  setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href
      safeCheck()
    }
  }, 500)
}

// ── Init ──────────────────────────────────────────────────────────────────────

log.debug('[READY] Content script loaded')

checkPlatform().catch((err) => log.error('checkPlatform error:', err))
watchUrlChanges()

// React to settings changes (pause toggles / blocklist) without a page reload.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if ('misirWebEnabled' in changes || 'misirAiEnabled' in changes || 'misirBlocklist' in changes) {
    checkPlatform().catch((err) => log.error('settings-change recheck error:', err))
  }
  // The offline cache (spaces/subspaces/markers) was just refreshed — re-run the
  // match on this tab so a space the user just created starts matching at once.
  if ('misirCacheSyncedAt' in changes && currentMode) {
    lastPreviewHash = null
    matchComputed = false
    schedulePreview(200)
  }
})

// ── App → extension bridge ───────────────────────────────────────────────────
// The Misir web app posts a message whenever the user changes their spaces so the
// extension can refresh its offline cache immediately, instead of waiting for the
// periodic (30-min) sync alarm. The re-sync then re-matches all open tabs (above).
function isMisirAppOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    if (u.hostname === 'misir.app' || u.hostname.endsWith('.misir.app')) return true
    if (u.hostname === 'localhost' && u.port === '3000') return true
    return false
  } catch {
    return false
  }
}

window.addEventListener('message', (event) => {
  // Only accept same-window messages from the Misir app origin.
  if (event.source !== window || !isMisirAppOrigin(event.origin)) return
  const data = event.data as { source?: string; type?: string } | null
  if (data?.source === 'misir-app' && data.type === 'MISIR_SPACES_CHANGED') {
    log.debug('App signalled spaces changed — forcing cache sync')
    sendMessageWithRetry({ type: 'FORCE_SYNC_CACHE' }).catch(() => {})
  }
})

// Some pages finish rendering their main content after document_idle — re-run
// the match once everything has loaded so the score is accurate on arrival.
if (document.readyState !== 'complete') {
  window.addEventListener('load', () => {
    if (currentMode === 'web') {
      lastPreviewHash = null
      schedulePreview(150)
    }
  }, { once: true })
}

// Re-check the match when the tab regains focus (the user may have continued
// the conversation in another tab). We deliberately DON'T reset lastPreviewHash
// here: if the visible text is unchanged, refreshPreview's hash guard skips the
// round-trip, so a focus flap costs nothing. Only genuinely new content re-runs.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentMode) {
    schedulePreview(400)
  }
})

// Notify background we're ready
sendMessageWithRetry({ type: 'CONTENT_READY', url: window.location.href }).catch(() => {})

// Cleanup on unload
window.addEventListener('pagehide', () => {
  conversationObserver?.disconnect()
  conversationObserver = null
  engagement.destroy()
  destroyToolbar()
})