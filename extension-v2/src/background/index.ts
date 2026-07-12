/**
 * Background Service Worker
 * Handles: artifact capture, engagement updates, cache sync, retry queue, consent management
 */

import { createConsola } from 'consola'
import {
  db, getSubspacesWithMarkers, getPendingCount, clearLocalData,
  getFailedArtifacts, getFailedCount, requeueFailedArtifacts, discardFailedArtifacts,
  MAX_SYNC_ATTEMPTS,
} from '@/lib/db'
import { apiCapture, apiUpdateEngagement, apiGetCache, apiGetMe, apiSyncConsent, apiLearnMarkers } from '@/lib/api'
import { processText, extractLearnableTerms } from '@/lib/nlp'
import { findBestMatch, hasKeywordEvidence } from '@/lib/matching'
import type { MatchResult } from '@/lib/matching'
import type { Space, SubspaceWithMarkers } from '@/lib/types'
import { redactPII } from '@/lib/redact'
import { chatCaptureToText } from '@/lib/types/chat'
import type {
  CapturePageMessage,
  CaptureAIChatMessage,
  UpdateEngagementMessage,
  CaptureResultMessage,
  ContentSource,
  PlatformType,
  EngagementLevel,
} from '@/lib/types'

const log = createConsola({ level: 4 }).withTag('background')
// Dedicated logger for the matching pipeline so its output is easy to spot and
// filter in the service-worker console.
const matchLog = createConsola({ level: 4 }).withTag('match')

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

    // Signal all content scripts that the cache changed so open tabs re-run their
    // match immediately (e.g. against a space the user just created in the app).
    try {
      await chrome.storage.local.set({ misirCacheSyncedAt: Date.now() })
    } catch {
      /* best-effort */
    }
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
    const res = await apiCapture(clampPayload(payload))
    // If the server dropped our space (stale cache after a space was deleted),
    // the artifact was stored without one — our local "saved to X" is wrong.
    if (res && res.space_accepted === false) {
      log.warn(`Server rejected space ${payload.space_id} (stale cache?) — saved without a space; forcing cache re-sync`)
      syncCache().catch(() => {})
    }
    return res?.id ?? null
  } catch (err: any) {
    if (err.name === 'ConsentRequiredError') throw err
    log.error('Backend capture failed:', err?.message || err)
    return null
  }
}

async function writeSyncStatus(): Promise<void> {
  try {
    const [pendingCount, failedCount] = await Promise.all([getPendingCount(), getFailedCount()])
    await chrome.storage.local.set({
      misirSyncStatus: { lastSyncedMs: Date.now(), pendingCount, failedCount },
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
    dbg('Save skipped: no spaces cached yet — open the app to sync, then retry')
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
    dbg(`Already captured this page in the last 24h — not saved again (${msg.url})`)
    return { matched: false, duplicate: true }
  }

  const match = await computeMatch(msg.textContent, subspacesWithMarkers)
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
    engagement_level: msg.engagementLevel ?? 'latent',
    dwell_time_ms: msg.dwellTimeMs ?? 0,
    scroll_depth: msg.scrollDepth ?? 0,
    reading_depth: msg.readingDepth ?? 0,
    space_id: match.subspace.spaceId,
    subspace_id: match.subspace.id,
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
        engagementLevel: msg.engagementLevel ?? 'latent',
        dwellTimeMs: msg.dwellTimeMs ?? 0,
        scrollDepth: msg.scrollDepth ?? 0,
        readingDepth: msg.readingDepth ?? 0,
        baseWeight: msg.baseWeight ?? 0.2,
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
  if (subspacesWithMarkers.length === 0) {
    dbg('Save skipped: no spaces cached yet — open the app to sync, then retry')
    return { matched: false }
  }

  // Dedup by content hash
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await db.pendingArtifacts
    .filter((a) => a.contentHash === contentHash && a.capturedAt > oneDayAgo)
    .first()

  if (recent) {
    dbg(`Already captured this conversation in the last 24h — not saved again ("${capture.title}")`)
    return { matched: false, duplicate: true }
  }

  const text = chatCaptureToText(capture)
  const match = await computeMatch(text, subspacesWithMarkers)
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
    engagement_level: msg.engagementLevel ?? 'active',
    dwell_time_ms: msg.dwellTimeMs ?? 0,
    scroll_depth: msg.scrollDepth ?? 0,
    reading_depth: msg.readingDepth ?? 0,
    space_id: match.subspace.spaceId,
    subspace_id: match.subspace.id,
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
        engagementLevel: msg.engagementLevel ?? 'active',
        dwellTimeMs: msg.dwellTimeMs ?? 0,
        scrollDepth: msg.scrollDepth ?? 0,
        readingDepth: msg.readingDepth ?? 0,
        baseWeight: msg.baseWeight ?? 2.0,
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

  const match = await computeMatch(text, subspacesWithMarkers)
  if (!match) return { matched: false }

  return {
    matched: true,
    subspaceId: match.subspace.id,
    spaceName: (await db.spaces.get(match.subspace.spaceId))?.name,
    subspaceName: match.subspace.name,
    confidence: match.confidence,
  }
}

// ── Match correction (feedback loop) ─────────────────────────────────────────
// When the user overrides the match and picks the correct subspace, we (a) save
// the artifact there, and (b) teach that subspace the page's salient vocabulary
// as low-weight "learned" markers — so next time a similar page matches on its
// own. This is how the markers get better than the LLM's original feature fluff.

interface CorrectMatchMessage {
  type: 'CORRECT_MATCH'
  text: string
  spaceId: number
  subspaceId: number
  url: string
  normalizedUrl: string
  domain: string
  title?: string
  contentHash: string
  wordCount: number
  contentSource: ContentSource
  platform: PlatformType
  engagementLevel?: EngagementLevel
  dwellTimeMs?: number
  scrollDepth?: number
  readingDepth?: number
  baseWeight?: number
}

// Salient candidate terms from a corrected page → learned markers. POS/NER-gated
// (see extractLearnableTerms) so dates, ordinals, colours and generic words can't
// become markers and later cause false matches.
function extractCandidateTerms(text: string): string[] {
  return extractLearnableTerms(text)
}

async function handleCorrection(msg: CorrectMatchMessage): Promise<CaptureResultMessage> {
  const subspaces = await getSubspacesWithMarkers()
  const chosen = subspaces.find((s) => s.id === msg.subspaceId)
  const spaceId = msg.spaceId ?? chosen?.spaceId
  if (!spaceId) return { matched: false }

  const capturedAt = new Date().toISOString()
  const payload = {
    url: msg.url,
    normalized_url: msg.normalizedUrl,
    domain: msg.domain,
    title: redactPII(msg.title),
    extracted_text: redactPII(msg.text),
    content_hash: msg.contentHash,
    word_count: msg.wordCount,
    content_source: msg.contentSource,
    platform: msg.platform,
    engagement_level: msg.engagementLevel ?? 'active',
    dwell_time_ms: msg.dwellTimeMs ?? 0,
    scroll_depth: msg.scrollDepth ?? 0,
    reading_depth: msg.readingDepth ?? 0,
    space_id: spaceId,
    subspace_id: msg.subspaceId,
    matched_marker_ids: [],
    tags: [],
    metadata: { corrected: true },
    captured_at: capturedAt,
  }

  let remoteId: number | null = null
  try {
    remoteId = await pushArtifactToBackend(payload)
  } catch (err: any) {
    if (err?.name === 'ConsentRequiredError') {
      await noteConsentNeeded(err.purpose)
      return { matched: false }
    }
    log.error('Correction capture failed:', errText(err))
  }

  if (remoteId === null) {
    // Queue locally so a correction isn't lost when the backend is unreachable.
    try {
      await db.pendingArtifacts.add({
        userId: 'pending', spaceId, subspaceId: msg.subspaceId,
        title: redactPII(msg.title), url: msg.url, normalizedUrl: msg.normalizedUrl,
        domain: msg.domain, extractedText: redactPII(msg.text), contentHash: msg.contentHash,
        wordCount: msg.wordCount, contentSource: msg.contentSource,
        engagementLevel: msg.engagementLevel ?? 'active', dwellTimeMs: msg.dwellTimeMs ?? 0,
        scrollDepth: msg.scrollDepth ?? 0, readingDepth: msg.readingDepth ?? 0,
        baseWeight: msg.baseWeight ?? 2.0, decayRate: 'medium', relevance: 1,
        matchedMarkerIds: [], metadata: { corrected: true, platform: msg.platform },
        capturedAt: new Date(capturedAt), syncAttempts: 1,
      })
    } catch (err) {
      log.error('Correction queue failed:', errText(err))
    }
  } else {
    await writeSyncStatus()
  }

  // Teach the subspace this page's vocabulary, then resync so the new markers
  // reach matching on all open tabs.
  const terms = extractCandidateTerms(msg.text)
  if (terms.length) {
    try {
      const res = await apiLearnMarkers(spaceId, msg.subspaceId, terms)
      matchLog.info(
        `Learned ${res.added.length} marker(s) for "${chosen?.name ?? 'subspace'}": ${res.added.map((m) => m.label).join(', ')}`,
      )
    } catch (err) {
      log.warn('Learn markers failed:', errText(err))
    }
  }
  await syncCache()

  return {
    matched: true,
    remoteId: remoteId ?? undefined,
    subspaceId: msg.subspaceId,
    spaceName: (await db.spaces.get(spaceId))?.name,
    subspaceName: chosen?.name,
    confidence: 1,
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
    .filter((a) => !a.syncedAt && (a.syncAttempts ?? 0) < MAX_SYNC_ATTEMPTS)
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
      subspace_id: artifact.subspaceId,
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

// ── Semantic model (offscreen document) ──────────────────────────────────────

const OFFSCREEN_URL = 'src/offscreen/index.html'
let creatingOffscreen: Promise<void> | null = null

async function ensureOffscreen(): Promise<void> {
  // hasDocument is available in newer Chrome; guard for older builds.
  const has = await (chrome.offscreen as any).hasDocument?.()
  if (has) return
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['WORKERS' as chrome.offscreen.Reason],
        justification: 'Run the on-device embedding model for semantic matching.',
      })
      .finally(() => {
        creatingOffscreen = null
      })
  }
  await creatingOffscreen
}

// Ask the offscreen document to load the model (downloads on first run).
async function enableSemantic(): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureOffscreen()
    const res: any = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'SEMANTIC_LOAD' })
    if (res?.ok) {
      await chrome.storage.local.set({ misirModelReady: true })
      return { ok: true }
    }
    return { ok: false, error: res?.error || 'load failed' }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}

// "Degraded" = the model was enabled (misirModelReady) but embedding is failing,
// so matching has silently fallen back to keyword-only. We persist this so the
// popup can TELL the user instead of leaving them to wonder why matches got worse.
async function setModelDegraded(degraded: boolean): Promise<void> {
  try {
    const { misirModelDegraded } = await chrome.storage.local.get('misirModelDegraded')
    const isDegraded = !!misirModelDegraded
    if (degraded === isDegraded) return // avoid needless writes / storage churn
    if (degraded) await chrome.storage.local.set({ misirModelDegraded: Date.now() })
    else await chrome.storage.local.remove('misirModelDegraded')
  } catch {
    /* best-effort */
  }
}

// Embed text through the offscreen model (used by matching once ready).
async function semanticEmbed(text: string, kind: 'query' | 'document'): Promise<number[] | null> {
  try {
    const { misirModelReady } = await chrome.storage.local.get('misirModelReady')
    if (!misirModelReady) return null
    await ensureOffscreen()
    const res: any = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'SEMANTIC_EMBED', text, kind })
    if (res?.ok) {
      await setModelDegraded(false) // a good embed clears any prior degraded state
      return res.vector as number[]
    }
    // Enabled but the embed failed — matching just fell back to keyword-only.
    log.warn('Semantic embed returned no vector — matching degraded to keyword-only')
    await setModelDegraded(true)
    return null
  } catch (err: any) {
    log.error('Semantic embed failed:', errText(err))
    await setModelDegraded(true)
    return null
  }
}

// Force a clean reload of the model (recover from a degraded/wedged state).
async function reloadSemantic(): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureOffscreen()
    const res: any = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'SEMANTIC_LOAD', reload: true })
    if (res?.ok) {
      await chrome.storage.local.set({ misirModelReady: true })
      await setModelDegraded(false)
      return { ok: true }
    }
    return { ok: false, error: res?.error || 'reload failed' }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}

// ── Semantic scoring (topic similarity per subspace) ─────────────────────────
// Embed the page/chat once (query) and each subspace's topical fingerprint
// (document), then cosine. Subspace vectors are cached — keyed by a hash of
// their text — so only the query is embedded on a warm cache.

// Nomic vectors are L2-normalized, so cosine == dot product.
function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

// A subspace's topical fingerprint: its name, description, and marker labels.
function subspaceDocText(s: SubspaceWithMarkers): string {
  const markers = s.markers.map((m) => m.label).join(', ')
  return [s.name, s.description ?? '', markers].filter(Boolean).join('. ')
}

// A space's topical fingerprint: its name, goal, description, and the union of
// all its subspaces' marker labels. One clean vector per space beats averaging
// the subspace vectors — it separates spaces more sharply when Nomic compresses
// scores (see the two-stage space decision in matching.ts).
function spaceDocText(space: Space, members: SubspaceWithMarkers[]): string {
  const labels = new Set<string>()
  for (const s of members) for (const m of s.markers) labels.add(m.label)
  return [space.name, space.goal ?? '', space.description ?? '', Array.from(labels).join(', ')]
    .filter(Boolean)
    .join('. ')
}

function textHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return `${s.length}:${h}`
}

// Nomic's context is generous, but longer text just slows WASM inference for no
// gain in topic signal — cap it.
const MAX_EMBED_CHARS = 2000

// Cached document vectors, keyed by `sub:<id>` / `space:<id>`. Persisted so a
// warm cache only ever embeds the query at match time.
type Embed = { hash: string; vec: number[] }
let embedCache: Map<string, Embed> | null = null

async function loadEmbedCache(): Promise<Map<string, Embed>> {
  if (embedCache) return embedCache
  try {
    const { misirEmbeds } = await chrome.storage.local.get('misirEmbeds')
    embedCache = new Map(Object.entries((misirEmbeds ?? {}) as Record<string, Embed>))
  } catch {
    embedCache = new Map()
  }
  return embedCache
}

async function persistEmbedCache(): Promise<void> {
  if (!embedCache) return
  const obj: Record<string, Embed> = {}
  for (const [k, v] of embedCache) obj[k] = v
  try {
    await chrome.storage.local.set({ misirEmbeds: obj })
  } catch {
    /* best-effort cache */
  }
}

// Get-or-embed a document vector by cache key; returns null on a model hiccup.
// Sets `dirty.changed` when it actually embedded (so the caller persists once).
async function docVector(
  cache: Map<string, Embed>,
  key: string,
  docText: string,
  dirty: { changed: boolean },
): Promise<number[] | null> {
  const hash = textHash(docText)
  let entry = cache.get(key)
  if (!entry || entry.hash !== hash) {
    const vec = await semanticEmbed(docText.slice(0, MAX_EMBED_CHARS), 'document')
    if (!vec) return null
    entry = { hash, vec }
    cache.set(key, entry)
    dirty.changed = true
  }
  return entry.vec
}

interface SemanticScores {
  bySubspace: Map<number, number>
  bySpace: Map<number, number>
}

// The live preview fires on every DOM mutation / focus change, often for text
// that hasn't changed. Memoize the last query embedding so those repeats reuse
// it (subspace/space vectors are already cached) — a redundant match then costs
// only cosine math, no WASM inference.
let lastQuery: { hash: string; vec: number[] } | null = null

// Cosine similarity of the page against every subspace AND every space, or null
// when semantic matching isn't available (model off, or embeds couldn't be
// produced) — callers then fall back to keyword-only matching.
async function semanticScores(
  text: string,
  spaces: Space[],
  subspaces: SubspaceWithMarkers[],
): Promise<SemanticScores | null> {
  const query = text.slice(0, MAX_EMBED_CHARS)
  const qHash = textHash(query)
  let qVec: number[] | null
  if (lastQuery && lastQuery.hash === qHash) {
    qVec = lastQuery.vec
  } else {
    qVec = await semanticEmbed(query, 'query')
    if (qVec) lastQuery = { hash: qHash, vec: qVec }
  }
  if (!qVec) return null

  const cache = await loadEmbedCache()
  const dirty = { changed: false }
  const bySubspace = new Map<number, number>()
  const bySpace = new Map<number, number>()

  const membersBySpace = new Map<number, SubspaceWithMarkers[]>()
  for (const s of subspaces) {
    const arr = membersBySpace.get(s.spaceId) ?? []
    arr.push(s)
    membersBySpace.set(s.spaceId, arr)
  }

  for (const s of subspaces) {
    const vec = await docVector(cache, `sub:${s.id}`, subspaceDocText(s), dirty)
    if (vec) bySubspace.set(s.id, cosineSim(qVec, vec))
  }

  for (const space of spaces) {
    const docText = spaceDocText(space, membersBySpace.get(space.id) ?? [])
    const vec = await docVector(cache, `space:${space.id}`, docText, dirty)
    if (vec) bySpace.set(space.id, cosineSim(qVec, vec))
  }

  if (dirty.changed) await persistEmbedCache()
  return bySubspace.size || bySpace.size ? { bySubspace, bySpace } : null
}

// Single entry point for matching: keyword + (when enabled) semantic topic
// similarity. Falls back to keyword-only if the model isn't ready.
async function computeMatch(
  text: string,
  subspaces: SubspaceWithMarkers[],
): Promise<MatchResult | null> {
  const nlpResult = processText(text)
  const preview = text.slice(0, 80).replace(/\s+/g, ' ').trim()

  // Lexical pre-gate (Readability + wink NLP) runs BEFORE any embedding: if the
  // page contains none of any space's markers, it can't match — bail without
  // paying for on-device inference.
  if (!hasKeywordEvidence(text, nlpResult, subspaces)) {
    const line = `No keyword evidence across ${subspaces.length} subspace(s) — skipped "${preview}…"`
    matchLog.info(line)
    dbg(line)
    return null
  }

  const spaces = await db.spaces.toArray()
  const semantic = await semanticScores(text, spaces, subspaces)
  const mode = semantic ? 'semantic + keyword' : 'keyword-only'

  const header = `Matching (${mode}) across ${subspaces.length} subspace(s) — "${preview}…"`
  matchLog.info(header)
  dbg(header)

  const lines: string[] = []
  const match = findBestMatch(text, nlpResult, subspaces, {
    semanticById: semantic?.bySubspace,
    semanticBySpace: semantic?.bySpace,
    // Each candidate's score breakdown → console (consola) + the options debug log.
    debug: (m) => {
      lines.push(m)
      dbg(m)
    },
  })

  for (const l of lines) matchLog.log(l)

  if (match) {
    const line = `→ ${match.subspace.name} @ ${(match.confidence * 100).toFixed(1)}% (space ${match.subspace.spaceId}, markers ${match.matchedMarkerIds.length})`
    matchLog.success(line)
    dbg(line)
  } else {
    const line = semantic
      ? '→ no match (every subspace below the semantic floor / threshold)'
      : '→ no match (every subspace below the keyword threshold)'
    matchLog.warn(line)
    dbg(line)
  }

  return match
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
    Promise.all([getPendingCount(), getFailedCount()]).then(([pendingCount, failedCount]) => {
      chrome.storage.local.get('misirSyncStatus', (r) => {
        sendResponse({
          lastSyncedMs: r.misirSyncStatus?.lastSyncedMs ?? null,
          pendingCount,
          failedCount,
        })
      })
    }).catch(() => sendResponse({ lastSyncedMs: null, pendingCount: 0, failedCount: 0 }))
    return true
  }

  if (message.type === 'FORCE_SYNC_CACHE') {
    syncCache()
      .then(() => sendResponse({ ok: true }))
      .catch((err: any) => sendResponse({ ok: false, error: err?.message || String(err) }))
    return true
  }

  // Stuck saves (exhausted retries) — listed in the popup so nothing is lost silently.
  if (message.type === 'GET_FAILED_SAVES') {
    getFailedArtifacts()
      .then((items) => sendResponse({
        items: items.map((a) => ({
          id: a.id,
          title: a.title,
          domain: a.domain,
          contentSource: a.contentSource,
          capturedAt: a.capturedAt instanceof Date ? a.capturedAt.getTime() : a.capturedAt,
        })),
      }))
      .catch(() => sendResponse({ items: [] }))
    return true
  }

  if (message.type === 'RETRY_FAILED_SAVES') {
    requeueFailedArtifacts()
      .then(async (requeued) => {
        await retryPending()
        await writeSyncStatus()
        const remaining = await getFailedCount()
        sendResponse({ ok: true, requeued, remaining })
      })
      .catch((err: any) => sendResponse({ ok: false, error: err?.message || String(err) }))
    return true
  }

  if (message.type === 'DISCARD_FAILED_SAVES') {
    discardFailedArtifacts()
      .then(async (discarded) => {
        await writeSyncStatus()
        sendResponse({ ok: true, discarded })
      })
      .catch((err: any) => sendResponse({ ok: false, error: err?.message || String(err) }))
    return true
  }

  if (message.type === 'SET_CLERK_TOKEN') {
    import('@/lib/auth').then(({ cacheClerkToken }) => cacheClerkToken(message.token))
    return false
  }

  // Token for extension pages — cookie-based (see authToken in lib/api.ts).
  if (message.type === 'GET_CLERK_TOKEN') {
    import('@/lib/auth')
      .then(({ getCachedClerkToken }) => getCachedClerkToken())
      .then((token) => sendResponse({ token }))
      .catch(() => sendResponse({ token: null }))
    return true
  }

  // Signed-in status — drives the popup's sign-in prompt. Rather than guess from
  // the (fragile, 60s-expiry) session cookie, we probe a real authenticated
  // endpoint: GET /me 403s ONLY on auth (no consent logic), so a 200 means we can
  // truly authenticate and a 401/403 means we can't. A network error is "unknown"
  // → we don't nag. This is ground truth, and the popup only polls it while the
  // prompt is showing, so it clears the instant sign-in takes effect.
  if (message.type === 'GET_AUTH_STATE') {
    apiGetMe()
      .then(() => sendResponse({ signedIn: true }))
      .catch((e: any) => {
        const status = e?.response?.status
        sendResponse({ signedIn: !(status === 401 || status === 403) })
      })
    return true
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

  // Spaces + subspaces for the toolbar's correction picker (from the Dexie cache).
  if (message.type === 'GET_SPACES_TREE') {
    Promise.all([db.spaces.toArray(), db.subspaces.toArray()])
      .then(([spaces, subs]) => {
        const bySpace = new Map<number, Array<{ id: number; name: string }>>()
        for (const s of subs) {
          const arr = bySpace.get(s.spaceId) ?? []
          arr.push({ id: s.id, name: s.name })
          bySpace.set(s.spaceId, arr)
        }
        sendResponse({
          spaces: spaces.map((sp) => ({ id: sp.id, name: sp.name, subspaces: bySpace.get(sp.id) ?? [] })),
        })
      })
      .catch(() => sendResponse({ spaces: [] }))
    return true
  }

  if (message.type === 'CORRECT_MATCH') {
    handleCorrection(message as CorrectMatchMessage)
      .then(sendResponse)
      .catch((err) => { log.error('Correction error:', errText(err)); sendResponse({ matched: false }) })
    return true
  }

  if (message.type === 'UPDATE_ENGAGEMENT') {
    handleUpdateEngagement(message as UpdateEngagementMessage).catch((err) =>
      log.error('Engagement update error:', err),
    )
    return false
  }

  if (message.type === 'SIGN_OUT') {
    embedCache = null
    Promise.all([clearLocalData(), chrome.storage.local.remove(['misirEmbeds', 'misirSaved'])])
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

  // ── Semantic model ──
  if (message.type === 'SEMANTIC_STATUS') {
    chrome.storage.local
      .get(['misirModelReady', 'misirModelDegraded'])
      .then((r) => sendResponse({ ready: !!r.misirModelReady, degraded: !!r.misirModelDegraded }))
      .catch(() => sendResponse({ ready: false, degraded: false }))
    return true
  }

  if (message.type === 'SEMANTIC_ENABLE') {
    enableSemantic().then(sendResponse)
    return true
  }

  if (message.type === 'SEMANTIC_RELOAD') {
    reloadSemantic().then(sendResponse)
    return true
  }

  if (message.type === 'SEMANTIC_TEST') {
    semanticEmbed(String(message.text || 'guava juice recipe'), 'query')
      .then((vec) => sendResponse({ ok: !!vec, dim: vec?.length ?? 0, sample: vec?.slice(0, 4) ?? [] }))
      .catch((err) => sendResponse({ ok: false, error: errText(err) }))
    return true
  }

  // Diagnostics: run the wink-nlp pre-gate stage on a sample and report back.
  if (message.type === 'NLP_TEST') {
    try {
      const sample =
        'The researchers were brewing several batches of Darjeeling tea in London while comparing steeping times.'
      const r = processText(sample)
      // wink lemmatizes ("brewing"→"brew") and finds entities; the regex fallback
      // does neither — so either signal means the real model is active.
      const winkActive =
        r.entities.length > 0 ||
        r.tokens.includes('brew') ||
        r.tokens.includes('researcher') ||
        r.tokens.includes('compare')
      sendResponse({
        ok: true,
        engine: winkActive ? 'wink' : 'fallback',
        tokenCount: r.tokens.length,
        tokens: r.tokens.slice(0, 10),
        entities: r.entities.slice(0, 6),
      })
    } catch (err) {
      sendResponse({ ok: false, error: errText(err) })
    }
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

// ── Smart-matching nudge badge ───────────────────────────────────────────────
// Draw a subtle dot on the toolbar icon while the on-device model is off (and
// the user hasn't dismissed the prompt), so they discover the popup's one-time
// "Enable smart matching" step even if they never open it on their own.

async function updateSmartMatchBadge(): Promise<void> {
  try {
    const { misirModelReady, misirSmartMatchDismissed, misirModelDegraded } =
      await chrome.storage.local.get(['misirModelReady', 'misirSmartMatchDismissed', 'misirModelDegraded'])
    if (misirModelDegraded) {
      // Enabled but failing — flag it so the user notices matching is degraded.
      await chrome.action.setBadgeText({ text: '!' })
      await chrome.action.setBadgeBackgroundColor({ color: '#C8746A' })
    } else if (!misirModelReady && !misirSmartMatchDismissed) {
      await chrome.action.setBadgeText({ text: '●' })
      await chrome.action.setBadgeBackgroundColor({ color: '#D97757' })
    } else {
      await chrome.action.setBadgeText({ text: '' })
    }
  } catch {
    /* action API unavailable — non-fatal */
  }
}

// Keep the badge in sync when the model is enabled, dismissed, or degrades.
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === 'local' &&
    ('misirModelReady' in changes || 'misirSmartMatchDismissed' in changes || 'misirModelDegraded' in changes)
  ) {
    updateSmartMatchBadge()
  }
})

chrome.runtime.onInstalled.addListener(() => {
  updateSmartMatchBadge()
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

  updateSmartMatchBadge()

  try {
    log.debug('Service Worker initializing...')
    await syncCache()
    log.info('Service Worker ready')
  } catch (err) {
    log.error('Service Worker initialization failed:', err)
  }
}

initializeServiceWorker()