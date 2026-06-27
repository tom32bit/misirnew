/**
 * Misir MV3 Service Worker — rewired to call backend API (§7 of plan).
 *
 * What changed vs old version:
 * - All supabase.from(...) calls → apiCapture / apiUpdateEngagement / apiGetCache
 * - Auth → Clerk JWT via chrome.storage.session (§2.3)
 * - Session management removed (backend handles it)
 * - Cache sync pulls from GET /cache instead of Supabase tables
 */
import { createConsola } from 'consola'
import { db } from '@/lib/db'
import { processText } from '@/lib/nlp'
import { findBestMatch } from '@/lib/matching'
import {
  apiCapture,
  apiUpdateEngagement,
  apiGetCache,
  ConsentRequiredError,
} from '@/lib/api'
import type {
  CapturePageMessage,
  CaptureResultMessage,
  UpdateEngagementMessage,
  Marker,
  Space,
  Subspace,
  SubspaceWithMarkers,
} from '@/types'
import { chatCaptureToText } from '@/types/chat'
import type { CaptureAIChatMessage } from '@/types/chat'
import { redactPII } from '@/lib/redact'

const log = createConsola({ level: 4 }).withTag('background')

// ── Cache sync ─────────────────────────────────────────────────────────────

async function syncCache(): Promise<void> {
  try {
    const cache = await apiGetCache()

    const spaces: Space[] = (cache.spaces || []).map((r: any) => ({
      id: r.id, userId: r.user_id, name: r.name,
      description: r.description, goal: r.goal, evidence: null,
      createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
    }))

    const subspaces: Subspace[] = (cache.subspaces || []).map((r: any) => ({
      id: r.id, spaceId: r.space_id, userId: r.user_id, name: r.name,
      description: r.description ?? undefined,
      artifactCount: 0, confidence: 1.0,
      createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
    }))

    const markers: Marker[] = (cache.markers || []).map((r: any) => ({
      id: r.id, spaceId: r.space_id, userId: r.user_id,
      label: r.label, weight: r.weight, createdAt: new Date(r.created_at),
    }))

    // subspace_markers not returned by /cache — re-fetch from local or skip
    // (matching works on marker labels; subspace-marker junction only needed for confidence)
    // Replace the entire local cache atomically — bulkPut only upserts and
    // leaves deleted backend records behind. clear+bulkAdd inside a transaction
    // keeps the tables in sync with the backend without a stale-data window.
    await db.transaction('rw', [db.spaces, db.subspaces, db.markers], async () => {
      await db.spaces.clear()
      await db.subspaces.clear()
      await db.markers.clear()
      await db.spaces.bulkAdd(spaces)
      await db.subspaces.bulkAdd(subspaces)
      await db.markers.bulkAdd(markers)
    })

    log.info(`Cache synced — ${spaces.length} spaces, ${subspaces.length} subspaces, ${markers.length} markers`)
    dbg(`Cache synced — ${spaces.length} spaces, ${subspaces.length} subspaces, ${markers.length} markers`)
  } catch (err: any) {
    log.error('syncCache failed:', err?.message || err)
    dbg(`syncCache FAILED: ${err?.message || err}`)
  }
}

// Build SubspaceWithMarkers from local Dexie tables.
// Markers are space-scoped (marker.spaceId), not subspace-scoped, so we group
// all markers of a space and assign them to every subspace in that space.
async function getSubspacesWithMarkers(): Promise<SubspaceWithMarkers[]> {
  const [subspaces, markers] = await Promise.all([
    db.subspaces.toArray(),
    db.markers.toArray(),
  ])

  const markersBySpaceId = new Map<number, Marker[]>()
  for (const m of markers) {
    const list = markersBySpaceId.get(m.spaceId) ?? []
    list.push(m)
    markersBySpaceId.set(m.spaceId, list)
  }

  return subspaces.map((s) => ({
    ...s,
    markers: markersBySpaceId.get(s.spaceId) ?? [],
  }))
}

// ── Push artifact to backend ───────────────────────────────────────────────

interface ArtifactPayload {
  url: string
  normalized_url: string
  domain?: string
  title?: string
  extracted_text?: string
  content_hash?: string
  word_count: number
  content_source: string
  platform: string
  engagement_level: string
  dwell_time_ms: number
  scroll_depth: number
  reading_depth: number
  space_id?: number
  matched_marker_ids: number[]
  tags: string[]
  metadata: Record<string, unknown>
  /** ISO UTC timestamp of when the user actually captured this — set client-side
   *  so offline retries preserve the original capture time rather than using
   *  server clock at sync time. */
  captured_at: string
}

// Backend (CaptureRequest) length caps. Readability returns the full article
// text with no limit, so a long page (Wikipedia, docs) can exceed extracted_text
// and get rejected with a 422 before any logic runs. Clamp every capped string
// field here — the single chokepoint all capture paths flow through — to match.
const CAPS = {
  url: 4000,
  normalized_url: 4000,
  domain: 255,
  title: 2000,
  extracted_text: 200_000,
  content_hash: 200,
} as const

function clampPayload(p: ArtifactPayload): ArtifactPayload {
  const clamped = { ...p }
  for (const [key, max] of Object.entries(CAPS) as [keyof typeof CAPS, number][]) {
    const v = clamped[key]
    if (typeof v === 'string' && v.length > max) {
      clamped[key] = v.slice(0, max)
    }
  }
  return clamped
}

async function writeSyncStatus(): Promise<void> {
  try {
    const pendingCount = await db.pendingArtifacts
      .filter((a) => !a.syncedAt && (a.syncAttempts ?? 0) < 5)
      .count()
    await chrome.storage.local.set({
      misirSyncStatus: { lastSyncedMs: Date.now(), pendingCount },
    })
  } catch {
    /* best-effort */
  }
}

async function pushArtifactToBackend(payload: ArtifactPayload): Promise<number | null> {
  try {
    const res: any = await apiCapture(clampPayload(payload))
    return res?.id ?? null
  } catch (err: any) {
    // Consent gate — surface as an opt-in notice, never a silent retry.
    if (err instanceof ConsentRequiredError) throw err
    log.error('Backend capture failed:', err?.message || err)
    return null
  }
}

// Record that capture was blocked for lack of consent so the popup can show an
// opt-in notice. Set when the backend reports consent_required.
async function noteConsentNeeded(purpose?: string): Promise<void> {
  try {
    await chrome.storage.local.set({ misirNeedsConsent: { at: Date.now(), purpose: purpose ?? null } })
  } catch {
    /* ignore */
  }
  dbg(`Capture blocked — opt in required (${purpose ?? 'capture'}). Open Misir to enable.`)
}

async function clearConsentNotice(): Promise<void> {
  try {
    await chrome.storage.local.remove('misirNeedsConsent')
  } catch {
    /* ignore */
  }
}

// ── Capture handler ────────────────────────────────────────────────────────

async function handleCapture(msg: CapturePageMessage): Promise<CaptureResultMessage> {
  const subspacesWithMarkers = await getSubspacesWithMarkers()
  if (subspacesWithMarkers.length === 0) {
    log.debug('No subspaces in cache — skipping match for', msg.url)
    dbg(`No subspaces in cache — skipping ${msg.title || msg.url}`)
    return { matched: false }
  }

  // Deduplicate: skip if same normalizedUrl was captured locally in the last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await db.pendingArtifacts
    .where('normalizedUrl')
    .equals(msg.normalizedUrl)
    .and((a) => a.capturedAt > oneDayAgo)
    .first()
  if (recent) {
    log.debug('Duplicate skipped:', msg.url)
    dbg(`Duplicate skipped: "${msg.title || msg.url}"`)
    return { matched: false }
  }

  const nlpResult = processText(msg.textContent)
  dbg(`Matching "${msg.title}" — ${subspacesWithMarkers.length} subspace(s), markers: [${subspacesWithMarkers.map(s => `${s.name}(${s.markers.map(m => m.label).join(',')})`).join(' | ')}]`)
  const match = findBestMatch(msg.textContent, nlpResult, subspacesWithMarkers, dbg)
  if (!match) {
    log.debug('No match:', msg.url)
    dbg(`No match: "${msg.title || msg.url}"`)
    return { matched: false }
  }

  const capturedAt = new Date().toISOString()
  const payload: ArtifactPayload = {
    url: msg.url,
    normalized_url: msg.normalizedUrl,
    domain: msg.domain,
    title: redactPII(msg.title),
    extracted_text: redactPII(msg.textContent),
    content_hash: msg.contentHash,
    word_count: msg.wordCount,
    content_source: 'web',
    platform: 'web',
    engagement_level: 'latent',
    dwell_time_ms: 0,
    scroll_depth: 0,
    reading_depth: 0,
    space_id: match.subspace.spaceId,
    matched_marker_ids: match.matchedMarkerIds,
    tags: [],
    metadata: {},
    captured_at: capturedAt,
  }

  let remoteId: number | null
  try {
    remoteId = await pushArtifactToBackend(payload)
  } catch (err) {
    if (err instanceof ConsentRequiredError) { await noteConsentNeeded(err.purpose); return { matched: false } }
    throw err
  }

  if (remoteId !== null) {
    await clearConsentNotice()
    await writeSyncStatus()
    log.success(`Saved "${msg.title}" → ${match.subspace.name} (${(match.confidence * 100).toFixed(0)}%)`)
    dbg(`Saved "${msg.title}" → ${match.subspace.name} (${(match.confidence * 100).toFixed(0)}%)`)
  } else {
    // Queue locally for retry — store the original capturedAt so retries
    // don't overwrite it with the server clock at sync time.
    await db.pendingArtifacts.add({
      userId: 'pending',
      spaceId: match.subspace.spaceId,
      subspaceId: match.subspace.id,
      title: redactPII(msg.title),
      url: msg.url,
      normalizedUrl: msg.normalizedUrl,
      domain: msg.domain,
      extractedText: redactPII(msg.textContent),
      contentHash: msg.contentHash,
      wordCount: msg.wordCount,
      contentSource: 'web',
      engagementLevel: 'latent',
      dwellTimeMs: 0,
      scrollDepth: 0,
      readingDepth: 0,
      baseWeight: 0.2,
      decayRate: 'high',
      relevance: match.confidence,
      matchedMarkerIds: match.matchedMarkerIds,
      capturedAt: new Date(capturedAt),
      syncAttempts: 1,
    })
    log.warn(`Queued locally — backend unavailable for "${msg.title}"`)
    dbg(`Queued locally (backend down): "${msg.title}"`)
  }

  return {
    matched: true,
    remoteId: remoteId ?? undefined,
    subspaceId: match.subspace.id,
    spaceName: (await db.spaces.get(match.subspace.spaceId))?.name,
    subspaceName: match.subspace.name,
    confidence: match.confidence,
  }
}

// ── AI chat capture handler ────────────────────────────────────────────────

async function handleAIChat(msg: CaptureAIChatMessage): Promise<CaptureResultMessage> {
  const { capture, normalizedUrl, domain, contentHash, wordCount } = msg
  const text = chatCaptureToText(capture)

  const subspacesWithMarkers = await getSubspacesWithMarkers()
  if (subspacesWithMarkers.length === 0) return { matched: false }

  // Dedup
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await db.pendingArtifacts
    .filter((a) => a.contentHash === contentHash && a.capturedAt > oneDayAgo)
    .first()
  if (recent) {
    log.debug(`AI chat duplicate skipped: "${capture.title}"`)
    return { matched: false }
  }

  const nlpResult = processText(text)
  const match = findBestMatch(text, nlpResult, subspacesWithMarkers)
  if (!match) {
    log.debug(`No match for ${capture.platform} chat "${capture.title}"`)
    return { matched: false }
  }

  const aiCapturedAt = new Date().toISOString()
  const payload: ArtifactPayload = {
    url: capture.url,
    normalized_url: normalizedUrl,
    domain,
    title: redactPII(capture.title),
    extracted_text: redactPII(text),
    content_hash: contentHash,
    word_count: wordCount,
    content_source: 'ai_chat',
    platform: capture.platform,
    engagement_level: 'active',
    dwell_time_ms: 0,
    scroll_depth: 0,
    reading_depth: 0,
    space_id: match.subspace.spaceId,
    matched_marker_ids: match.matchedMarkerIds,
    tags: [],
    metadata: {
      conversationId: capture.conversationId,
      messageCount: capture.messages.length,
    },
    captured_at: aiCapturedAt,
  }

  let remoteId: number | null
  try {
    remoteId = await pushArtifactToBackend(payload)
  } catch (err) {
    if (err instanceof ConsentRequiredError) { await noteConsentNeeded(err.purpose); return { matched: false } }
    throw err
  }
  if (remoteId !== null) {
    await clearConsentNotice()
    await writeSyncStatus()
    log.success(`AI chat saved: ${capture.platform} "${capture.title}" → ${match.subspace.name}`)
  } else {
    await db.pendingArtifacts.add({
      userId: 'pending',
      spaceId: match.subspace.spaceId,
      subspaceId: match.subspace.id,
      title: redactPII(capture.title),
      url: capture.url,
      normalizedUrl,
      domain,
      extractedText: redactPII(text),
      contentHash,
      wordCount,
      contentSource: 'ai_chat',
      engagementLevel: 'active',
      dwellTimeMs: 0,
      scrollDepth: 0,
      readingDepth: 0,
      baseWeight: 2.0,
      decayRate: 'medium',
      relevance: match.confidence,
      matchedMarkerIds: match.matchedMarkerIds,
      metadata: { platform: capture.platform },
      capturedAt: new Date(aiCapturedAt),
      syncAttempts: 1,
    })
    log.warn(`AI chat queued locally: "${capture.title}"`)
  }

  return {
    matched: true,
    remoteId: remoteId ?? undefined,
    subspaceId: match.subspace.id,
    spaceName: (await db.spaces.get(match.subspace.spaceId))?.name,
    subspaceName: match.subspace.name,
    confidence: match.confidence,
  }
}

// ── Engagement update ──────────────────────────────────────────────────────

async function handleUpdateEngagement(msg: UpdateEngagementMessage): Promise<void> {
  const { remoteId, dwellTimeMs, scrollDepth, readingDepth, engagementLevel } = msg
  try {
    await apiUpdateEngagement(remoteId, {
      engagement_level: engagementLevel,
      dwell_time_ms: dwellTimeMs,
      scroll_depth: scrollDepth,
      reading_depth: readingDepth,
    })
    log.debug(`Engagement updated — artifact ${remoteId}: ${engagementLevel}`)
  } catch (err: any) {
    log.error(`Engagement update failed for artifact ${remoteId}:`, err?.message || err)
  }
}

// ── Retry pending (local queue → backend) ─────────────────────────────────

async function retryPending(): Promise<void> {
  const pending = await db.pendingArtifacts
    .filter((a) => !a.syncedAt && (a.syncAttempts ?? 0) < 5)
    .toArray()

  for (const artifact of pending) {
    const payload: ArtifactPayload = {
      url: artifact.url,
      normalized_url: artifact.normalizedUrl,
      domain: artifact.domain,
      title: redactPII(artifact.title),
      extracted_text: redactPII(artifact.extractedText),
      content_hash: artifact.contentHash,
      word_count: artifact.wordCount,
      content_source: artifact.contentSource,
      platform: (artifact.metadata as any)?.platform || 'web',
      engagement_level: artifact.engagementLevel,
      dwell_time_ms: artifact.dwellTimeMs,
      scroll_depth: artifact.scrollDepth,
      reading_depth: artifact.readingDepth,
      space_id: artifact.spaceId,
      matched_marker_ids: artifact.matchedMarkerIds,
      tags: [],
      metadata: (artifact.metadata as Record<string, unknown>) || {},
      captured_at: artifact.capturedAt.toISOString(),
    }

    let remoteId: number | null
    try {
      remoteId = await pushArtifactToBackend(payload)
    } catch (err) {
      // Stop the retry sweep once consent is required — retrying won't help
      // until the user opts in.
      if (err instanceof ConsentRequiredError) { await noteConsentNeeded(err.purpose); break }
      throw err
    }
    if (remoteId !== null) {
      await clearConsentNotice()
      await db.pendingArtifacts.update(artifact.id!, { remoteId, syncedAt: new Date() })
      log.info(`Retried and synced artifact ${artifact.id}`)
    } else {
      await db.pendingArtifacts.update(artifact.id!, { syncAttempts: (artifact.syncAttempts ?? 0) + 1 })
    }
  }
  await writeSyncStatus()
}

// ── Message listener ───────────────────────────────────────────────────────

const debugLogs: string[] = []
const MAX_LOGS = 100

function dbg(msg: string): void {
  const entry = `[${new Date().toLocaleTimeString()}] ${msg}`
  debugLogs.push(entry)
  if (debugLogs.length > MAX_LOGS) debugLogs.shift()
}

// GET_COOKIE allowlist (origin -> permitted cookie names). The only legitimate
// caller is the Kimi adapter reading its HttpOnly auth cookie; everything else
// is denied so a content script on any other origin can't turn the service
// worker into an arbitrary-cookie reader (confused deputy).
const COOKIE_ALLOWLIST: Record<string, string[]> = {
  'https://www.kimi.com': ['kimi-auth'],
}

function senderOrigin(sender: chrome.runtime.MessageSender): string | null {
  try {
    if (sender.origin) return new URL(sender.origin).origin
    if (sender.url) return new URL(sender.url).origin
  } catch {
    /* fall through */
  }
  return null
}

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse: (r: any) => void) => {
    // Defense in depth: only accept messages from this extension's own
    // contexts (content scripts + extension pages). onMessage already excludes
    // other extensions/web pages, but assert it explicitly.
    if (sender.id !== chrome.runtime.id) return false
    if (message.type === 'DEBUG_LOG') {
      const body = typeof message.message === 'string' ? message.message : JSON.stringify(message.data ?? message.message)
      const logMessage = `[${new Date().toLocaleTimeString()}] ${body}`
      log.debug(logMessage)
      debugLogs.push(logMessage)
      if (debugLogs.length > MAX_LOGS) debugLogs.shift()
      return false
    }

    if (message.type === 'GET_COOKIE') {
      const origin = senderOrigin(sender)
      const allowedNames = origin ? COOKIE_ALLOWLIST[origin] : undefined
      // Require a content-script sender (sender.tab) on an allowlisted origin
      // requesting an allowlisted cookie. Derive the URL from the validated
      // origin — never trust the client-supplied url — so no arbitrary cookie
      // (incl. HttpOnly on other sites) can be read.
      if (!sender.tab || !allowedNames || !allowedNames.includes(message.name)) {
        dbg(`GET_COOKIE denied: origin=${origin} name=${message?.name}`)
        sendResponse({ value: null })
        return true
      }
      chrome.cookies.get({ url: origin!, name: message.name }, (cookie) => {
        sendResponse({ value: cookie?.value ?? null })
      })
      return true
    }

    if (message.type === 'GET_DEBUG_LOGS') {
      const logs = [
        `SW Status: ${initializationComplete ? 'ready' : 'initializing'}`,
        ...(initializationError ? [`Init Error: ${initializationError.message}`] : []),
        ...debugLogs,
      ]
      sendResponse({ logs })
      return true
    }

    if (message.type === 'GET_SYNC_STATUS') {
      db.pendingArtifacts
        .filter((a) => !a.syncedAt && (a.syncAttempts ?? 0) < 5)
        .count()
        .then((pendingCount) => {
          chrome.storage.local.get('misirSyncStatus', (r) => {
            sendResponse({
              lastSyncedMs: r.misirSyncStatus?.lastSyncedMs ?? null,
              pendingCount,
            })
          })
        })
        .catch(() => sendResponse({ lastSyncedMs: null, pendingCount: 0 }))
      return true
    }

    if (message.type === 'FORCE_SYNC_CACHE') {
      syncCache()
        .then(() => sendResponse({ ok: true }))
        .catch((err: any) => sendResponse({ ok: false, error: err?.message || String(err) }))
      return true
    }

    // When the popup/sidepanel sets a fresh Clerk token, cache it in session storage
    if (message.type === 'SET_CLERK_TOKEN') {
      import('@/lib/api').then(({ cacheClerkToken }) => cacheClerkToken(message.token))
      return false
    }

    if (message.type === 'CAPTURE_PAGE') {
      handleCapture(message as CapturePageMessage)
        .then(sendResponse)
        .catch((err) => { log.error('Web capture error:', err); sendResponse({ matched: false }) })
      return true
    }

    if (message.type === 'CAPTURE_AI_CHAT') {
      handleAIChat(message as CaptureAIChatMessage)
        .then(sendResponse)
        .catch((err) => { log.error('AI chat capture error:', err); sendResponse({ matched: false }) })
      return true
    }

    if (message.type === 'UPDATE_ENGAGEMENT') {
      handleUpdateEngagement(message as UpdateEngagementMessage).catch((err) =>
        log.error('Engagement update error:', err),
      )
      return false
    }

    return false
  },
)

// ── Init ───────────────────────────────────────────────────────────────────

let initializationComplete = false
let initializationError: Error | null = null

async function initializeServiceWorker(): Promise<void> {
  // Register alarm listener unconditionally — Chrome re-creates the SW on each
  // wake-up, so the listener must always be re-attached.
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'retryPending') {
      retryPending().catch((err) => log.error('Retry error:', err))
    }
    if (alarm.name === 'syncCache') {
      syncCache().catch((err) => log.error('Cache sync error:', err))
    }
  })

  // Only create alarms when they don't already exist.  chrome.alarms.create
  // with an existing name silently resets the period — calling it on every
  // SW wake-up would continuously push the next-fire time forward.
  const [retryAlarm, syncAlarm] = await Promise.all([
    chrome.alarms.get('retryPending'),
    chrome.alarms.get('syncCache'),
  ])
  if (!retryAlarm) chrome.alarms.create('retryPending', { periodInMinutes: 5 })
  if (!syncAlarm)  chrome.alarms.create('syncCache',    { periodInMinutes: 30 })

  try {
    log.debug('Service Worker initializing...')
    await syncCache()
    initializationComplete = true
    log.info('Service Worker ready')
  } catch (err) {
    initializationError = err instanceof Error ? err : new Error(String(err))
    log.error('Service Worker initialization failed:', initializationError)
  }
}

initializeServiceWorker()
