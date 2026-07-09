/**
 * Content Script Entry Point
 * - Detects platform
 * - Injects toolbar for AI chat platforms
 * - Handles web page capture on demand
 * - Listens for messages from background
 */

import { createConsola } from 'consola'
import { initToolbar, showToolbar, hideToolbar, setToolbarSaving, setToolbarOutcome, setToolbarPreview, setToolbarChecking, destroyToolbar } from './toolbar'
import { extractPageContent } from './web-capture'
import { extractConversation, getExtractor } from './extractors'
import { detectPlatform } from './platform-detector'
import { sha256 } from '@/lib/utils'
import { getConsent, gpcOptOut } from '@/lib/consent'
import { getBlocklist, isHostBlocked } from '@/lib/blocklist'
import type { CapturePageMessage, CaptureAIChatMessage, CaptureResultMessage } from '@/lib/types'

const log = createConsola({ level: 4 }).withTag('content')

// 'aichat' → a supported AI chat platform (DOM extractor); 'web' → an ordinary
// article/page (Readability); null → don't offer capture here.
type PageMode = 'aichat' | 'web' | null

let contextDead = false
let currentMode: PageMode = null

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

async function checkPlatform(): Promise<void> {
  const mode = await resolveMode()
  const was = currentMode
  currentMode = mode

  if (mode && !was) {
    log.debug(`Misir active (${mode})`)
    initToolbar(handleSaveClick)
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
  if (contextDead || !currentMode) { setToolbarChecking(false); setToolbarPreview(null); return }
  if (gpcOptOut()) { setToolbarChecking(false); setToolbarPreview(null); return }

  // On web pages, extracting the article (Readability) takes a beat — show a
  // "Checking…" state up front so the card isn't blank on load.
  if (currentMode === 'web') setToolbarChecking(true)

  const text = await previewText()
  if (!text) { setToolbarChecking(false); setToolbarPreview(null); return }

  // Skip re-querying if the content hasn't materially changed.
  const hash = `${text.length}:${text.slice(0, 48)}:${text.slice(-48)}`
  if (hash === lastPreviewHash) { setToolbarChecking(false); return }
  lastPreviewHash = hash

  try {
    const result = await sendMessageWithRetry<CaptureResultMessage>({ type: 'PREVIEW_MATCH', text })
    setToolbarPreview(
      result?.matched
        ? { spaceName: result.spaceName, subspaceName: result.subspaceName, confidence: result.confidence }
        : null,
    )
  } catch (err) {
    log.debug('Preview match failed:', err instanceof Error ? err.message : String(err))
  } finally {
    setToolbarChecking(false)
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
    setToolbarOutcome({
      status: 'saved',
      spaceName: result.spaceName,
      subspaceName: result.subspaceName,
      confidence: result.confidence,
    })
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

    const message: CaptureAIChatMessage = {
      type: 'CAPTURE_AI_CHAT',
      capture: conversation,
      normalizedUrl: conversation.url,
      domain: new URL(conversation.url).hostname,
      contentHash: await sha256(text),
      wordCount: text.split(/\s+/).filter(Boolean).length,
    }

    reportOutcome(await sendMessageWithRetry<CaptureResultMessage>(message), `${conversation.platform} conversation`)
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

    const message: CapturePageMessage = {
      type: 'CAPTURE_PAGE',
      url: pageContent.url,
      normalizedUrl: pageContent.normalizedUrl,
      domain: pageContent.domain,
      title: pageContent.title,
      textContent: pageContent.textContent,
      contentHash: pageContent.contentHash,
      wordCount: pageContent.wordCount,
    }

    reportOutcome(await sendMessageWithRetry<CaptureResultMessage>(message), 'web page')
  } catch (err) {
    log.error('Web capture failed:', err)
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

// Re-check the match when the tab regains focus (spaces may have synced, or the
// user continued the conversation in another tab).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentMode) {
    lastPreviewHash = null
    schedulePreview(400)
  }
})

// Notify background we're ready
sendMessageWithRetry({ type: 'CONTENT_READY', url: window.location.href }).catch(() => {})

// Cleanup on unload
window.addEventListener('pagehide', () => {
  conversationObserver?.disconnect()
  conversationObserver = null
  destroyToolbar()
})