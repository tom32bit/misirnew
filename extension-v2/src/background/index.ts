/**
 * Background Service Worker
 * Handles: artifact capture, engagement updates, cache sync, retry queue, consent management
 */

import { createConsola } from 'consola'
import { db, getSubspacesWithMarkers, getPendingCount, clearLocalData } from '@/lib/db'
import { apiCapture, apiUpdateEngagement, apiGetCache, apiSyncConsent } from '@/lib/api'
import { processText } from '@/lib/nlp'
import { findBestMatch } from '@/lib/matching'
import { redactPII } from '@/lib/redact'
import { chatCaptureToText } from '@/lib/types/chat'
import type {
  CapturePageMessage,
  CaptureAIChatMessage,
  UpdateEngagementMessage,
  CaptureResultMessage,
} from '@/lib/types'

const log = createConsola({ level: 4 }).withTag('background')

// consola renders bare objects as "[object Object]"; pull out something useful.
function errText(err: unknown): string {
  if (err == null) return String(err)
  if (typeof err === 'string') return err
  const e = err as { message?: string; name?: string }
  if (e.message) return `${e.name ? e.name + ': ' : ''}${e.message}`
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

// ── Cache sync ───────────────────────────────────────────────────────────────

async function syncCache(): Promise<void> {
  try {
    const cache = await apiGetCache()

    const spaces = (cache.spaces || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      description: r.description,
      goal: r.goal,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }))

    // Group markers by subspace from the subspace_marker junction so each
    // subspace matches on its own markers (not the whole space's).
    const markerIdsBySubspace = new Map<number, number[]>()
    for (const sm of (cache.subspace_markers || []) as Array<{ subspace_id: number; marker_id: number }>) {
      const list = markerIdsBySubspace.get(sm.subspace_id) ?? []
      list.push(sm.marker_id)
      markerIdsBySubspace.set(sm.subspace_id, list)
    }

    const subspaces = (cache.subspaces || []).map((r: any) => ({
      id: r.id,
      spaceId: r.space_id,
      userId: r.user_id,
      name: r.name,
      description: r.description ?? undefined,
      artifactCount: 0,
      confidence: 1.0,
      markerIds: markerIdsBySubspace.get(r.id) ?? [],
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }))

    const markers = (cache.markers || []).map((r: any) => ({
      id: r.id,
      spaceId: r.space_id,
      userId: r.user_id,
      label: r.label,
      weight: r.weight,
      createdAt: new Date(r.created_at),
    }))

    await db.transaction('rw', [db.spaces, db.subspaces, db.markers], async () => {
      await db.spaces.clear()
      await db.subspaces.clear()
      await db.markers.clear()
      await db.spaces.bulkAdd(spaces)
      await db.subspaces.bulkAdd(subspaces)
      await db.markers.bulkAdd(markers)
    })

    log.info(`Cache synced — ${spaces.length} spaces, ${subspaces.length} subspaces, ${markers.length} markers`)
  } catch (err: any) {
    log.error('syncCache failed:', err?.message || err)
  }
}

// ── Artifact payload helpers ────────────────────────────────────────────────

const CAPS = {
  url: 4000,
  normalized_url: 4000,
  domain: 255,
  title: 2000,
  extracted_text: 200_000,
  content_hash: 200,
} as const

function clampPayload(payload: any): any {
  const clamped = { ...payload }
  for (const [key, max] of Object.entries(CAPS) as [keyof typeof CAPS, number][]) {
    const v = clamped[key]
    if (typeof v === 'string' && v.length > max) {
      clamped[key] = v.slice(0, max)
    }
  }
  return clamped
}

async function pushArtifactToBackend(payload: any): Promise<number | null> {
  try {
    const res: any = await apiCapture(clampPayload(payload))
    return res?.id ?? null
  } catch (err: any) {
    if (err.name === 'ConsentRequiredError') throw err
    log.error('Backend capture failed:', err?.message || err)
    return null
  }
}

async function writeSyncStatus(): Promise<void> {
  try {
    const pendingCount = await getPendingCount()
    await chrome.storage.local.set({
      misirSyncStatus: { lastSyncedMs: Date.now(), pendingCount },
    })
  } catch {
    /* best-effort */
  }
}

async function noteConsentNeeded(purpose?: string): Promise<void> {
  try {
    await chrome.storage.local.set({ misirNeedsConsent: { at: Date.now(), purpose: purpose ?? null } })
  } catch {
    /* ignore */
  }
}

async function clearConsentNotice(): Promise<void> {
  try {
    await chrome.storage.local.remove('misirNeedsConsent')
  } catch {
    /* ignore */
  }
}

// ── Capture handler ──────────────────────────────────────────────────────────

async function handleCapture(msg: CapturePageMessage): Promise<CaptureResultMessage> {
  const subspacesWithMarkers = await getSubspacesWithMarkers()
  if (subspacesWithMarkers.length === 0) {
    log.debug('No subspaces in cache — skipping match for', msg.url)
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
    return { matched: false }
  }

  const nlpResult = processText(msg.textContent)
  const match = findBestMatch(msg.textContent, nlpResult, subspacesWithMarkers)
  if (!match) {
    log.debug('No match:', msg.url)
    return { matched: false }
  }

  const capturedAt = new Date().toISOString()
  const payload = {
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
  } catch (err: any) {
    if (err?.name === 'ConsentRequiredError') {
      await noteConsentNeeded(err.purpose)
      return { matched: false }
    }
    throw err
  }

  if (remoteId !== null) {
    await clearConsentNotice()
    await writeSyncStatus()
    log.success(`Saved "${msg.title}" → ${match.subspace.name} (${(match.confidence * 100).toFixed(0)}%)`)
  } else {
    // Queue locally for retry. A queue failure must not surface as "no match" —
    // the page did match; log it and still report the match to the UI.
    try {
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
    } catch (err) {
      log.error('Local queue failed:', errText(err))
    }
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

// ── AI chat capture handler ──────────────────────────────────────────────────

async function handleAIChat(msg: CaptureAIChatMessage): Promise<CaptureResultMessage> {
  const { capture, normalizedUrl, domain, contentHash, wordCount } = msg

  const subspacesWithMarkers = await getSubspacesWithMarkers()
  if (subspacesWithMarkers.length === 0) return { matched: false }

  // Dedup by content hash
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await db.pendingArtifacts
    .filter((a) => a.contentHash === contentHash && a.capturedAt > oneDayAgo)
    .first()

  if (recent) {
    log.debug(`AI chat duplicate skipped: "${capture.title}"`)
    return { matched: false }
  }

  const text = chatCaptureToText(capture)
  const nlpResult = processText(text)
  const match = findBestMatch(text, nlpResult, subspacesWithMarkers)
  if (!match) {
    log.debug(`No match for ${capture.platform} chat "${capture.title}"`)
    return { matched: false }
  }

  const aiCapturedAt = new Date().toISOString()
  const payload = {
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
  } catch (err: any) {
    if (err?.name === 'ConsentRequiredError') {
      await noteConsentNeeded(err.purpose)
      return { matched: false }
    }
    throw err
  }

  if (remoteId !== null) {
    await clearConsentNotice()
    await writeSyncStatus()
    log.success(`AI chat saved: ${capture.platform} "${capture.title}" → ${match.subspace.name}`)
  } else {
    try {
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
    } catch (err) {
      log.error('Local queue failed:', errText(err))
    }
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

// ── Match preview (local only, never saves) ─────────────────────────────────

async function handlePreviewMatch(text: string): Promise<CaptureResultMessage> {
  const subspacesWithMarkers = await getSubspacesWithMarkers()
  if (subspacesWithMarkers.length === 0) return { matched: false }

  const nlpResult = processText(text)
  log.debug('Match preview — subspace scores:')
  const match = findBestMatch(text, nlpResult, subspacesWithMarkers, (m) => log.debug(m))
  if (!match) return { matched: false }
  log.debug(`→ picked ${match.subspace.name} (${(match.confidence * 100).toFixed(0)}%)`)

  return {
    matched: true,
    subspaceId: match.subspace.id,
    spaceName: (await db.spaces.get(match.subspace.spaceId))?.name,
    subspaceName: match.subspace.name,
    confidence: match.confidence,
  }
}

// ── Engagement update ────────────────────────────────────────────────────────

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

// ── Retry pending (local queue → backend) ────────────────────────────────────

async function retryPending(): Promise<void> {
  const pending = await db.pendingArtifacts
    .filter((a) => !a.syncedAt && (a.syncAttempts ?? 0) < 5)
    .toArray()

  for (const artifact of pending) {
    const payload = {
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
    } catch (err: any) {
      if (err?.name === 'ConsentRequiredError') {
        await noteConsentNeeded(err.purpose)
        break // Stop retrying until user grants consent
      }
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

// ── Consent sync ─────────────────────────────────────────────────────────────

async function syncConsentToBackend(): Promise<void> {
  try {
    const consent = await chrome.storage.local.get('misirConsent')
    if (consent.misirConsent) {
      await apiSyncConsent({
        webCapture: consent.misirConsent.webCapture,
        aiChatCapture: consent.misirConsent.aiChatCapture,
      })
    }
  } catch (err) {
    log.error('Consent sync failed:', err)
  }
}

// ── Cookie getter (allowlisted) ──────────────────────────────────────────────

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

// ── Message listener ────────────────────────────────────────────────────────

const debugLogs: string[] = []
const MAX_LOGS = 100

function dbg(msg: string): void {
  const entry = `[${new Date().toLocaleTimeString()}] ${msg}`
  debugLogs.push(entry)
  if (debugLogs.length > MAX_LOGS) debugLogs.shift()
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Defense in depth: only accept messages from this extension's own contexts
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
    sendResponse({ logs: debugLogs })
    return true
  }

  if (message.type === 'GET_SYNC_STATUS') {
    getPendingCount().then((pendingCount) => {
      chrome.storage.local.get('misirSyncStatus', (r) => {
        sendResponse({
          lastSyncedMs: r.misirSyncStatus?.lastSyncedMs ?? null,
          pendingCount,
        })
      })
    }).catch(() => sendResponse({ lastSyncedMs: null, pendingCount: 0 }))
    return true
  }

  if (message.type === 'FORCE_SYNC_CACHE') {
    syncCache()
      .then(() => sendResponse({ ok: true }))
      .catch((err: any) => sendResponse({ ok: false, error: err?.message || String(err) }))
    return true
  }

  if (message.type === 'SET_CLERK_TOKEN') {
    import('@/lib/auth').then(({ cacheClerkToken }) => cacheClerkToken(message.token))
    return false
  }

  if (message.type === 'CAPTURE_PAGE') {
    handleCapture(message as CapturePageMessage)
      .then(sendResponse)
      .catch((err) => { log.error('Web capture error:', errText(err)); sendResponse({ matched: false }) })
    return true
  }

  if (message.type === 'CAPTURE_AI_CHAT') {
    handleAIChat(message as CaptureAIChatMessage)
      .then(sendResponse)
      .catch((err) => { log.error('AI chat capture error:', errText(err)); sendResponse({ matched: false }) })
    return true
  }

  if (message.type === 'PREVIEW_MATCH') {
    handlePreviewMatch((message as { text: string }).text)
      .then(sendResponse)
      .catch((err) => { log.error('Preview match error:', err); sendResponse({ matched: false }) })
    return true
  }

  if (message.type === 'UPDATE_ENGAGEMENT') {
    handleUpdateEngagement(message as UpdateEngagementMessage).catch((err) =>
      log.error('Engagement update error:', err),
    )
    return false
  }

  if (message.type === 'SIGN_OUT') {
    clearLocalData()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  if (message.type === 'SYNC_CONSENT') {
    syncConsentToBackend()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  return false
})

// ── Alarms ───────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'retryPending') {
    retryPending().catch((err) => log.error('Retry error:', err))
  }
  if (alarm.name === 'syncCache') {
    syncCache().catch((err) => log.error('Cache sync error:', err))
  }
})

// ── Init ──────────────────────────────────────────────────────────────────────

async function initializeServiceWorker(): Promise<void> {
  // Only create alarms when they don't already exist
  const [retryAlarm, syncAlarm] = await Promise.all([
    chrome.alarms.get('retryPending'),
    chrome.alarms.get('syncCache'),
  ])
  if (!retryAlarm) chrome.alarms.create('retryPending', { periodInMinutes: 5 })
  if (!syncAlarm) chrome.alarms.create('syncCache', { periodInMinutes: 30 })

  try {
    log.debug('Service Worker initializing...')
    await syncCache()
    log.info('Service Worker ready')
  } catch (err) {
    log.error('Service Worker initialization failed:', err)
  }
}

initializeServiceWorker()