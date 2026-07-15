import React from 'react'
import {
  Settings, ExternalLink, Loader2, ShieldAlert, Globe, Sparkles,
  Bookmark, Check, Plus, ScanLine, Terminal, RefreshCw, Copy,
  AlertTriangle, Trash2, FileWarning, LogIn,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { db, getPendingCount } from '@/lib/db'
import { getConsent, setConsent, gpcOptOut } from '@/lib/consent'
import { apiGetConsent, apiSyncConsent } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import type { TabState } from '@/lib/types'
import logoUrl from '@/assets/misir-logo.png'

// Claude-dark popup palette (mirrors --m-* / the redesign mockup).
const C = {
  app: '#262624', raised: '#2E2E2B', text: '#F2F0EA', text2: '#C6C4BC',
  text3: '#918F87', text4: '#6F6D66', accent: '#D97757', accent2: '#E0906F',
  accentSoft: 'rgba(217,119,87,0.12)', border: 'rgba(255,255,255,0.075)',
  border2: 'rgba(255,255,255,0.14)', good: '#83AD84', goodSoft: 'rgba(131,173,132,0.12)',
  danger: '#C8746A', dangerSoft: 'rgba(200,116,106,0.10)',
}
const SERIF = 'var(--font-display)'

const SECTION_LABEL: React.CSSProperties = {
  margin: '0 0 12px', fontSize: 10, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.09em', color: C.text4,
}

export function PopupApp() {
  const [webConsent, setWebConsent] = React.useState(false)
  const [aiConsent, setAiConsent] = React.useState(false)
  const [pending, setPending] = React.useState(0)
  const [spaceCount, setSpaceCount] = React.useState(0)
  const [subspaceCount, setSubspaceCount] = React.useState(0)
  const [lastSyncedMs, setLastSyncedMs] = React.useState<number | null>(null)
  const [tab, setTab] = React.useState<TabState | null>(null)
  const [faviconUrl, setFaviconUrl] = React.useState<string | null>(null)
  const [tabId, setTabId] = React.useState<number | null>(null)
  const [continuing, setContinuing] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  // null = unknown yet; false = signed out (show sign-in prompt).
  const [signedIn, setSignedIn] = React.useState<boolean | null>(null)
  const [showLog, setShowLog] = React.useState(false)
  const [logLines, setLogLines] = React.useState<string[]>([])
  const [copied, setCopied] = React.useState(false)
  // Smart (semantic) matching — first-run activation of the on-device model.
  const [semanticReady, setSemanticReady] = React.useState<boolean | null>(null)
  const [semanticDegraded, setSemanticDegraded] = React.useState(false)
  const [smartDismissed, setSmartDismissed] = React.useState(false)
  const [enabling, setEnabling] = React.useState(false)
  const [enableProgress, setEnableProgress] = React.useState(0)
  const [enableError, setEnableError] = React.useState<string | null>(null)
  const [justEnabled, setJustEnabled] = React.useState(false)
  // Saves that exhausted their sync retries — surfaced so they can't be lost silently.
  const [failedSaves, setFailedSaves] = React.useState<FailedSave[]>([])
  const [failedBusy, setFailedBusy] = React.useState<null | 'retry' | 'discard'>(null)
  const [failedNote, setFailedNote] = React.useState<string | null>(null)

  // Model download/init progress is broadcast from the offscreen document.
  React.useEffect(() => {
    const onMsg = (m: { type?: string; progress?: { progress?: number } }) => {
      if (m?.type === 'SEMANTIC_PROGRESS' && typeof m.progress?.progress === 'number') {
        setEnableProgress(Math.round(m.progress.progress))
      }
    }
    chrome.runtime.onMessage.addListener(onMsg)
    return () => chrome.runtime.onMessage.removeListener(onMsg)
  }, [])

  async function enableSmartMatching() {
    if (enabling) return
    setEnabling(true)
    setEnableProgress(0)
    setEnableError(null)
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'SEMANTIC_ENABLE' })) as { ok?: boolean; error?: string }
      if (res?.ok) {
        setSemanticReady(true)
        setJustEnabled(true)
        setTimeout(() => setJustEnabled(false), 3500)
      } else {
        setEnableError(res?.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setEnableError('Couldn’t reach the model. Please try again.')
    } finally {
      setEnabling(false)
    }
  }

  function dismissSmartMatching() {
    setSmartDismissed(true)
    chrome.storage.local.set({ misirSmartMatchDismissed: true }).catch(() => {})
  }

  // While the sign-in prompt is showing, re-probe auth so it clears on its own
  // the moment sign-in takes effect — no reopen, no manual dismiss. We stop
  // polling once signed in, so /me isn't hit repeatedly when it's not needed.
  React.useEffect(() => {
    if (signedIn !== false) return
    const id = setInterval(() => {
      chrome.runtime
        .sendMessage({ type: 'GET_AUTH_STATE' })
        .then((r: { signedIn?: boolean; known?: boolean } | undefined) => {
          // Only act on a DEFINITIVE answer — known:false means the probe
          // couldn't reach the backend (offline), not a sign-in change.
          if (r && r.known && typeof r.signedIn === 'boolean') setSignedIn(r.signedIn)
        })
        .catch(() => {})
    }, 3000)
    return () => clearInterval(id)
  }, [signedIn])

  // Recover a degraded model: force a clean reload (re-inits, re-downloads if the
  // browser evicted the cache). Reuses the same progress plumbing as first enable.
  async function reloadSmartMatching() {
    if (enabling) return
    setEnabling(true)
    setEnableProgress(0)
    setEnableError(null)
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'SEMANTIC_RELOAD' })) as { ok?: boolean; error?: string }
      if (res?.ok) {
        setSemanticDegraded(false)
        setSemanticReady(true)
        setJustEnabled(true)
        setTimeout(() => setJustEnabled(false), 3500)
      } else {
        setEnableError(res?.error || 'Reload failed. Please try again.')
      }
    } catch {
      setEnableError('Couldn’t reach the model. Please try again.')
    } finally {
      setEnabling(false)
    }
  }

  async function loadFailedSaves() {
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'GET_FAILED_SAVES' })) as { items?: FailedSave[] }
      setFailedSaves(res?.items ?? [])
    } catch {
      setFailedSaves([])
    }
  }

  async function retryFailedSaves() {
    if (failedBusy) return
    setFailedBusy('retry')
    setFailedNote(null)
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'RETRY_FAILED_SAVES' })) as
        { ok?: boolean; requeued?: number; remaining?: number }
      await loadFailedSaves()
      setPending(await getPendingCount())
      if (res?.ok) {
        const synced = (res.requeued ?? 0) - (res.remaining ?? 0)
        setFailedNote(
          res.remaining
            ? `${res.remaining} still couldn’t sync — check your connection and try again.`
            : synced > 0 ? `Synced ${synced} item${synced === 1 ? '' : 's'}.` : 'Requeued.',
        )
      } else {
        setFailedNote('Couldn’t retry right now. Please try again.')
      }
    } catch {
      setFailedNote('Couldn’t retry right now. Please try again.')
    } finally {
      setFailedBusy(null)
      setTimeout(() => setFailedNote(null), 5000)
    }
  }

  async function discardFailedSaves() {
    if (failedBusy) return
    setFailedBusy('discard')
    setFailedNote(null)
    try {
      await chrome.runtime.sendMessage({ type: 'DISCARD_FAILED_SAVES' })
      await loadFailedSaves()
    } catch {
      /* leave them listed if discard failed */
    } finally {
      setFailedBusy(null)
    }
  }

  async function fetchLogs() {
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'GET_DEBUG_LOGS' })) as { logs?: string[] }
      setLogLines(res?.logs ?? [])
    } catch {
      setLogLines([])
    }
  }

  function toggleLog() {
    const next = !showLog
    setShowLog(next)
    if (next) fetchLogs()
  }

  function copyLog() {
    navigator.clipboard.writeText(logLines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  React.useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      const [consent, pendingCount, spaces, subspaces, sync, tabState] = await Promise.all([
        getConsent(),
        getPendingCount(),
        db.spaces.count(),
        db.subspaces.count(),
        chrome.storage.local.get('misirSyncStatus'),
        loadTabState(),
      ])
      setWebConsent(consent.webCapture)
      setAiConsent(consent.aiChatCapture)
      setPending(pendingCount)
      setSpaceCount(spaces)
      setSubspaceCount(subspaces)
      setLastSyncedMs(sync.misirSyncStatus?.lastSyncedMs ?? null)
      setTab(tabState.state)
      setFaviconUrl(tabState.favicon)
      setTabId(tabState.tabId)

      // Smart-matching model status + whether the user dismissed the prompt.
      const [semStatus, dismiss] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'SEMANTIC_STATUS' }).catch(() => ({ ready: false, degraded: false })),
        chrome.storage.local.get('misirSmartMatchDismissed'),
      ])
      setSemanticReady(!!(semStatus as { ready?: boolean })?.ready)
      setSemanticDegraded(!!(semStatus as { degraded?: boolean })?.degraded)
      setSmartDismissed(!!dismiss.misirSmartMatchDismissed)
      await loadFailedSaves()

      // Auth: default to "signed in" if the SW doesn't answer, so we don't nag
      // during a slow wake-up — only prompt when we KNOW there's no session
      // (known:true + signedIn:false). known:false = offline/unreachable, which
      // is NOT a sign-in problem, so it never triggers the prompt.
      const auth = (await chrome.runtime
        .sendMessage({ type: 'GET_AUTH_STATE' })
        .catch(() => ({ signedIn: true, known: false }))) as { signedIn?: boolean; known?: boolean }
      setSignedIn(!(auth?.known && auth?.signedIn === false))
      try {
        await apiGetConsent()
      } catch {
        /* offline or signed out — local consent still governs the UI */
      }
    } catch (err) {
      console.error('Failed to load popup data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadTabState(): Promise<{ state: TabState | null; favicon: string | null; tabId: number | null }> {
    try {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
      const favicon = active?.favIconUrl || null
      const id = active?.id ?? null
      if (!active?.id) return { state: null, favicon, tabId: id }
      try {
        const state = (await chrome.tabs.sendMessage(active.id, { type: 'GET_TAB_STATE' })) as TabState
        return { state: state ?? null, favicon, tabId: id }
      } catch {
        // No content script on this page (chrome://, store pages, etc.)
        return {
          state: {
            kind: 'inactive', capturable: false, mode: null,
            title: active.title || active.url || 'This tab',
            domain: safeHost(active.url), url: active.url || '',
          },
          favicon, tabId: id,
        }
      }
    } catch {
      return { state: null, favicon: null, tabId: null }
    }
  }

  // "Save the continuation" — the initial save happens on the page toolbar (with
  // its consent warning); once saved, the popup can flush the added content.
  async function handleSaveContinuation() {
    if (tabId == null || continuing) return
    setContinuing(true)
    try {
      const res = (await chrome.tabs.sendMessage(tabId, { type: 'TRIGGER_SAVE' })) as { ok: boolean; state?: TabState }
      if (res?.state) setTab(res.state)
      setPending(await getPendingCount())
    } catch (err) {
      console.error('Save continuation failed:', err)
    } finally {
      setContinuing(false)
    }
  }

  async function handleConsentChange(type: 'web' | 'ai', value: boolean) {
    if (gpcOptOut()) return
    setSaving(true)
    if (type === 'web') setWebConsent(value)
    else setAiConsent(value)
    try {
      await setConsent({ [type === 'web' ? 'webCapture' : 'aiChatCapture']: value })
      await apiSyncConsent({
        webCapture: type === 'web' ? value : webConsent,
        aiChatCapture: type === 'ai' ? value : aiConsent,
      })
      chrome.runtime.sendMessage({ type: 'FORCE_SYNC_CACHE' })
    } catch (err) {
      console.error('Failed to save consent:', err)
      if (type === 'web') setWebConsent(!value)
      else setAiConsent(!value)
    } finally {
      setSaving(false)
    }
  }

  const gpcActive = gpcOptOut()

  const shell: React.CSSProperties = {
    width: 360, background: C.app, color: C.text, fontFamily: 'var(--font-sans)',
  }

  if (loading) {
    return (
      <div style={{ ...shell, padding: 40, textAlign: 'center' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ margin: '0 auto', color: C.accent }} />
        <p style={{ marginTop: 12, fontSize: 13, color: C.text3 }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={shell}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 17px 15px' }}>
        <img src={logoUrl} width={26} height={26} alt="Misir" style={{ borderRadius: 7 }} />
        <span style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, letterSpacing: '-0.005em', lineHeight: 1 }}>
          Misir
        </span>
        <SyncPill lastSyncedMs={lastSyncedMs} />
      </div>
      <Divider />

      <SignInBanner signedIn={signedIn} />

      <SmartMatchBanner
        ready={semanticReady}
        degraded={semanticDegraded}
        dismissed={smartDismissed}
        enabling={enabling}
        progress={enableProgress}
        error={enableError}
        justEnabled={justEnabled}
        onEnable={enableSmartMatching}
        onReload={reloadSmartMatching}
        onDismiss={dismissSmartMatching}
      />

      <FailedSavesBanner
        items={failedSaves}
        busy={failedBusy}
        note={failedNote}
        onRetry={retryFailedSaves}
        onDiscard={discardFailedSaves}
      />

      {/* On this tab */}
      <div style={{ padding: '16px 17px' }}>
        <h2 style={SECTION_LABEL}>On this tab</h2>
        <TabCard tab={tab} faviconUrl={faviconUrl} continuing={continuing} onSaveContinuation={handleSaveContinuation} />
      </div>
      <Divider />

      {/* Capture */}
      <div style={{ padding: '16px 17px' }}>
        <h2 style={SECTION_LABEL}>Capture</h2>
        {gpcActive && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, padding: '10px 12px',
            borderRadius: 10, background: C.dangerSoft, border: `1px solid rgba(200,116,106,0.28)`,
            fontSize: 11.5, color: C.text2, lineHeight: 1.4,
          }}>
            <ShieldAlert style={{ width: 15, height: 15, flex: 'none', color: C.danger }} />
            Global Privacy Control is on — capture is paused site-wide.
          </div>
        )}
        <div style={{
          borderRadius: 12, overflow: 'hidden',
          border: `1px solid ${C.border}`, background: C.raised,
        }}>
          <ConsentRow
            icon={<Globe size={15} />}
            title="Web pages"
            subtitle="Articles, docs & blogs"
            checked={webConsent}
            disabled={gpcActive || saving}
            onChange={(v) => handleConsentChange('web', v)}
          />
          <div style={{ height: 1, background: C.border }} />
          <ConsentRow
            icon={<Sparkles size={15} />}
            title="AI conversations"
            subtitle="ChatGPT, Claude, Gemini…"
            checked={aiConsent}
            disabled={gpcActive || saving}
            onChange={(v) => handleConsentChange('ai', v)}
          />
        </div>
        <p style={{ margin: '13px 3px 0', fontSize: 11, lineHeight: 1.55, color: C.text4 }}>
          Off by default. Consent stays on your device and syncs to your account.
        </p>
      </div>
      <Divider />

      {/* Status */}
      <div style={{ padding: '16px 17px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
          <h2 style={{ ...SECTION_LABEL, margin: 0 }}>Status</h2>
          <MatchModeChip ready={semanticReady} degraded={semanticDegraded} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Stat value={spaceCount} label="Spaces" accent />
          <Stat value={subspaceCount} label="Subspaces" />
          <Stat value={pending} label="Pending" />
        </div>
      </div>
      <Divider />

      {/* Match log (diagnostics) */}
      {showLog && (
        <>
          <div style={{ padding: '13px 15px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <span style={SECTION_LABEL}>Match log</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <MiniBtn onClick={fetchLogs} icon={<RefreshCw size={11} />}>Refresh</MiniBtn>
                <MiniBtn onClick={copyLog} icon={copied ? <Check size={11} /> : <Copy size={11} />}>
                  {copied ? 'Copied' : 'Copy'}
                </MiniBtn>
              </div>
            </div>
            <div style={{
              maxHeight: 190, overflow: 'auto', background: C.app, border: `1px solid ${C.border}`,
              borderRadius: 9, padding: '9px 10px',
              fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 10.5, lineHeight: 1.55,
            }}>
              {logLines.length ? (
                logLines.map((l, i) => (
                  <div key={i} style={{
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    color: l.startsWith('→') ? C.accent2
                      : l.startsWith('Matching') || l.startsWith('No keyword') ? C.text2
                        : C.text3,
                  }}>{l}</div>
                ))
              ) : (
                <span style={{ color: C.text4 }}>No recent match yet — reload the page to run one, then Refresh.</span>
              )}
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '13px 13px 15px' }}>
        <FootBtn icon={<Settings size={14} />} onClick={() => chrome.runtime.openOptionsPage()}>Settings</FootBtn>
        <FootBtn icon={<Terminal size={14} />} onClick={toggleLog}>{showLog ? 'Hide log' : 'Logs'}</FootBtn>
        <span style={{ flex: 1 }} />
        <FootBtn icon={<ExternalLink size={14} />} iconRight onClick={() => chrome.tabs.create({ url: 'https://misir.app' })}>
          Open app
        </FootBtn>
      </div>
    </div>
  )
}

// ── The live "On this tab" card ──────────────────────────────────────────────

function TabCard({ tab, faviconUrl, continuing, onSaveContinuation }: {
  tab: TabState | null; faviconUrl: string | null
  continuing: boolean; onSaveContinuation: () => void
}) {
  if (!tab) {
    return (
      <div style={cardStyle}>
        <p style={emptyText}>Couldn’t read this tab.</p>
      </div>
    )
  }

  const inactive = tab.kind === 'inactive'
  const info = tab.kind === 'match' ? tab.match : undefined
  const saved = (tab.kind === 'saved' || tab.kind === 'saved-continuation') ? tab.saved : undefined
  const pct = info?.confidence != null ? Math.round(info.confidence * 100) : null

  // Not a capturable page — a compact icon + message, no title/URL scaffolding.
  if (inactive) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          <Favicon url={null} domain={tab.domain} inactive />
          <p style={{ ...emptyText, marginTop: 4 }}>
            Misir isn’t active on this page. Open an article or an AI chat to start capturing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      {/* Tab identity */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        <Favicon url={faviconUrl} domain={tab.domain} inactive={inactive} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 500, color: C.text, lineHeight: 1.32,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {tab.title}
          </div>
          <div style={{ fontSize: 11.5, color: C.text4, marginTop: 3 }}>
            {tab.domain}{tab.mode === 'aichat' ? ' · conversation' : ''}
          </div>
        </div>
      </div>

      {/* State-specific body */}
      {info && pct != null && (
        <>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: C.text4 }}>Belongs to</span>
              <span style={{ fontSize: 11, color: C.text3, fontVariantNumeric: 'tabular-nums' }}>{pct}% confident</span>
            </div>
            <div style={{ marginTop: 8 }}>
              {info.subspaceName ? (
                <>
                  <div style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.25 }}>{info.spaceName || 'Your library'}</div>
                  <div style={{ marginTop: 3, fontFamily: SERIF, fontSize: 17, lineHeight: 1.25, letterSpacing: '-0.01em', color: C.accent2 }}>
                    {info.subspaceName}
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.25, letterSpacing: '-0.01em', color: C.accent2 }}>
                  {info.spaceName || 'Your library'}
                </div>
              )}
            </div>
            <div style={{ marginTop: 11, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: C.accent, width: `${pct}%` }} />
            </div>
          </div>
          <ToolbarHint icon={<Bookmark size={13} />}>
            Save it from the <b style={hintB}>Misir</b> button on the page — cleaned and PII-redacted on-device first.
          </ToolbarHint>
        </>
      )}

      {saved && (
        <>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 22, height: 22, flex: 'none', borderRadius: '50%', background: C.goodSoft, color: C.good, display: 'grid', placeItems: 'center' }}>
              <Check style={{ width: 13, height: 13 }} />
            </span>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 15, color: C.text, letterSpacing: '-0.005em' }}>
                Saved to <span style={{ color: C.accent2 }}>{saved.subspaceName || saved.spaceName || 'your library'}</span>
              </div>
              {saved.spaceName && saved.subspaceName && (
                <div style={{ fontSize: 11.5, color: C.text4, marginTop: 1 }}>{saved.spaceName}</div>
              )}
            </div>
          </div>
          {tab.kind === 'saved-continuation' && (
            <>
              <button onClick={onSaveContinuation} disabled={continuing} style={saveBtnStyle(continuing)}>
                {continuing
                  ? <><Loader2 size={15} className="animate-spin" />Saving…</>
                  : <><Plus size={15} />Save the continuation</>}
              </button>
              <p style={{ margin: '9px 3px 0', fontSize: 11, lineHeight: 1.5, color: C.text4 }}>
                You’ve added more since your last save — cleaned and PII-redacted on-device first.
              </p>
            </>
          )}
        </>
      )}

      {tab.kind === 'checking' && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 className="animate-spin" style={{ width: 14, height: 14, color: C.text3 }} />
          <span style={emptyText}>Checking this page against your spaces…</span>
        </div>
      )}

      {tab.kind === 'nomatch' && (
        <p style={{ ...emptyText, marginTop: 14 }}>
          This doesn’t fit any of your spaces, so nothing was captured. Misir only keeps what’s clearly relevant.
        </p>
      )}

      {tab.kind === 'gpc' && (
        <p style={{ ...emptyText, marginTop: 14 }}>
          Capture is paused here by Global Privacy Control.
        </p>
      )}
    </div>
  )
}

function ToolbarHint({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 15, display: 'flex', alignItems: 'center', gap: 9,
      padding: '10px 12px', borderRadius: 10,
      background: 'rgba(255,255,255,0.028)', border: `1px solid ${C.border}`,
    }}>
      <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 6, background: C.accentSoft, color: C.accent2, display: 'grid', placeItems: 'center' }}>
        {icon}
      </span>
      <span style={{ fontSize: 12, lineHeight: 1.45, color: C.text3 }}>{children}</span>
    </div>
  )
}

function Favicon({ url, domain, inactive }: { url: string | null; domain: string; inactive: boolean }) {
  const [broken, setBroken] = React.useState(false)
  const box: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, flex: 'none', marginTop: 1,
    background: inactive ? '#33322F' : '#2A2A27', color: C.text3,
    display: 'grid', placeItems: 'center', overflow: 'hidden',
  }
  if (inactive) {
    return <span style={box}><ScanLine style={{ width: 15, height: 15 }} /></span>
  }
  if (url && !broken) {
    return (
      <span style={box}>
        <img src={url} width={18} height={18} alt="" onError={() => setBroken(true)} style={{ borderRadius: 4 }} />
      </span>
    )
  }
  return <span style={{ ...box, fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#CFE0C4', background: '#35462F' }}>{(domain || '?').charAt(0).toUpperCase()}</span>
}

// ── Small building blocks ────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  borderRadius: 13, background: C.raised, border: `1px solid ${C.border}`, padding: '15px 15px 16px',
}
const emptyText: React.CSSProperties = { margin: 0, fontSize: 12.5, lineHeight: 1.55, color: C.text3 }
const hintB: React.CSSProperties = { color: C.text2, fontWeight: 600 }

function saveBtnStyle(busy: boolean): React.CSSProperties {
  return {
    marginTop: 14, width: '100%', border: 'none', cursor: busy ? 'default' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 11, borderRadius: 11, background: C.accent, color: '#fff',
    fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, letterSpacing: '0.005em',
    opacity: busy ? 0.85 : 1,
  }
}

function Divider() {
  return <div style={{ height: 1, background: C.border }} />
}

// First-run activation of the on-device semantic model. Prominent until the user
// enables it (matching's core value) or dismisses it (keyword-only fallback).
function SmartMatchBanner({
  ready, degraded, dismissed, enabling, progress, error, justEnabled, onEnable, onReload, onDismiss,
}: {
  ready: boolean | null
  degraded: boolean
  dismissed: boolean
  enabling: boolean
  progress: number
  error: string | null
  justEnabled: boolean
  onEnable: () => void
  onReload: () => void
  onDismiss: () => void
}) {
  const busyBlock = (
    <div style={{ marginTop: 12 }}>
      <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(4, progress)}%`, background: C.accent, borderRadius: 5, transition: 'width .25s' }} />
      </div>
      <div style={{ marginTop: 7, fontSize: 11.5, color: C.text3, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Loader2 size={12} className="animate-spin" />
        {progress > 0 ? `Loading… ${progress}%` : 'Starting…'}
      </div>
    </div>
  )

  // Brief success confirmation after enabling.
  if (justEnabled) {
    return (
      <>
        <div style={{ padding: '14px 15px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', borderRadius: 12,
            background: C.goodSoft, border: '1px solid rgba(131,173,132,0.28)',
          }}>
            <span style={{ width: 22, height: 22, flex: 'none', borderRadius: '50%', background: 'rgba(131,173,132,0.2)', color: C.good, display: 'grid', placeItems: 'center' }}>
              <Check size={13} />
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Smart matching is on</div>
              <div style={{ fontSize: 11.5, color: C.text4 }}>Pages now match by meaning, on-device.</div>
            </div>
          </div>
        </div>
        <Divider />
      </>
    )
  }

  // Enabled but embedding is failing — matching quietly fell back to keywords.
  // Tell the user plainly and give them a one-tap recovery.
  if (ready === true && degraded) {
    return (
      <>
        <div style={{ padding: '14px 15px' }}>
          <div style={{ borderRadius: 13, background: C.dangerSoft, border: '1px solid rgba(200,116,106,0.28)', padding: '14px 14px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 8, background: 'rgba(200,116,106,0.18)', color: C.danger, display: 'grid', placeItems: 'center' }}>
                <AlertTriangle size={15} />
              </span>
              <span style={{ fontFamily: SERIF, fontSize: 15, color: C.text, letterSpacing: '-0.005em' }}>Smart matching hit a snag</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: C.text2 }}>
              The on-device model stopped responding, so matching is running on <b style={{ color: C.text }}>keywords only</b> for now. Reloading usually fixes it.
            </p>
            {error && <p style={{ margin: '9px 1px 0', fontSize: 11.5, lineHeight: 1.45, color: C.danger }}>{error}</p>}
            {enabling ? busyBlock : (
              <button
                onClick={onReload}
                style={{
                  marginTop: 13, width: '100%', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 10, background: C.accent,
                  color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                }}
              >
                <RefreshCw size={13} />Reload model
              </button>
            )}
          </div>
        </div>
        <Divider />
      </>
    )
  }

  // Only prompt when we know the model is off and the user hasn't dismissed it.
  if (ready !== false || dismissed) return null

  return (
    <>
      <div style={{ padding: '14px 15px' }}>
        <div style={{ borderRadius: 13, background: C.accentSoft, border: '1px solid rgba(217,119,87,0.22)', padding: '14px 14px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 8, background: 'rgba(217,119,87,0.18)', color: C.accent2, display: 'grid', placeItems: 'center' }}>
              <Sparkles size={15} />
            </span>
            <span style={{ fontFamily: SERIF, fontSize: 15, color: C.text, letterSpacing: '-0.005em' }}>Turn on smart matching</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: C.text2 }}>
            Match pages to your spaces by <b style={{ color: C.text }}>meaning</b>, not just keywords. A one-time ~140 MB download that runs <b style={{ color: C.text }}>entirely on your device</b> — nothing is uploaded.
          </p>
          {error && <p style={{ margin: '9px 1px 0', fontSize: 11.5, lineHeight: 1.45, color: C.danger }}>{error}</p>}
          {enabling ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(4, progress)}%`, background: C.accent, borderRadius: 5, transition: 'width .25s' }} />
              </div>
              <div style={{ marginTop: 7, fontSize: 11.5, color: C.text3, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={12} className="animate-spin" />
                {progress > 0 ? `Downloading… ${progress}%` : 'Starting download…'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
              <button
                onClick={onEnable}
                style={{
                  flex: 1, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 10, background: C.accent,
                  color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                }}
              >
                {error ? 'Try again' : 'Enable'}
              </button>
              <button
                onClick={onDismiss}
                style={{
                  border: `1px solid ${C.border2}`, cursor: 'pointer', padding: '9px 13px', borderRadius: 10,
                  background: 'transparent', color: C.text2, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                }}
              >
                Not now
              </button>
            </div>
          )}
        </div>
      </div>
      <Divider />
    </>
  )
}

// A save that exhausted its sync retries and would otherwise be silently lost.
interface FailedSave {
  id: number
  title: string
  domain: string
  contentSource: string
  capturedAt: number
}

// Surfaces stuck saves so the user can retry (e.g. after being offline) or
// discard them — never silent data loss. Renders nothing when the queue is clean.
function FailedSavesBanner({
  items, busy, note, onRetry, onDiscard,
}: {
  items: FailedSave[]
  busy: null | 'retry' | 'discard'
  note: string | null
  onRetry: () => void
  onDiscard: () => void
}) {
  if (items.length === 0) return null
  const n = items.length

  return (
    <>
      <div style={{ padding: '14px 15px' }}>
        <div style={{ borderRadius: 13, background: C.dangerSoft, border: '1px solid rgba(200,116,106,0.28)', padding: '14px 14px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 8, background: 'rgba(200,116,106,0.18)', color: C.danger, display: 'grid', placeItems: 'center' }}>
              <AlertTriangle size={15} />
            </span>
            <span style={{ fontFamily: SERIF, fontSize: 15, color: C.text, letterSpacing: '-0.005em' }}>
              {n} save{n === 1 ? '' : 's'} couldn’t sync
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: C.text2 }}>
            These are stored on your device but haven’t reached your account after several tries — usually a dropped connection. Retry when you’re back online, or discard them.
          </p>

          <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.slice(0, 4).map((it) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <FileWarning size={13} style={{ flex: 'none', color: C.text4 }} />
                <span style={{ fontSize: 11.5, color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.title || it.domain || 'Untitled'}
                </span>
              </div>
            ))}
            {n > 4 && <span style={{ fontSize: 11, color: C.text4, paddingLeft: 21 }}>and {n - 4} more…</span>}
          </div>

          {note && <p style={{ margin: '10px 1px 0', fontSize: 11.5, lineHeight: 1.45, color: C.text3 }}>{note}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
            <button
              onClick={onRetry}
              disabled={busy != null}
              style={{
                flex: 1, border: 'none', cursor: busy ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 10, background: C.accent,
                color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, opacity: busy ? 0.85 : 1,
              }}
            >
              {busy === 'retry' ? <><Loader2 size={13} className="animate-spin" />Retrying…</> : <><RefreshCw size={13} />Retry all</>}
            </button>
            <button
              onClick={onDiscard}
              disabled={busy != null}
              style={{
                border: `1px solid ${C.border2}`, cursor: busy ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 13px', borderRadius: 10, background: 'transparent', color: C.text2,
                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, opacity: busy ? 0.85 : 1,
              }}
            >
              {busy === 'discard' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Discard
            </button>
          </div>
        </div>
      </div>
      <Divider />
    </>
  )
}

// Shown when there's no synced Clerk session. The extension can't do anything
// without auth, so we point the user to sign in ONCE on the web app — the sync
// host then keeps the extension connected (no tab needed afterward).
// Auto-hides the moment we can authenticate (the popup re-checks live), so
// signing in on the web app clears it on its own — no manual dismiss needed.
function SignInBanner({ signedIn }: { signedIn: boolean | null }) {
  if (signedIn !== false) return null
  const host = (import.meta.env.VITE_CLERK_SYNC_HOST as string) || 'https://misir.app'
  return (
    <>
      <div style={{ padding: '14px 15px' }}>
        <div style={{ borderRadius: 13, background: C.accentSoft, border: '1px solid rgba(217,119,87,0.22)', padding: '14px 14px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 8, background: 'rgba(217,119,87,0.18)', color: C.accent2, display: 'grid', placeItems: 'center' }}>
              <LogIn size={15} />
            </span>
            <span style={{ fontFamily: SERIF, fontSize: 15, color: C.text, letterSpacing: '-0.005em' }}>Sign in to Misir</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: C.text2 }}>
            Capture needs you signed in. Open the Misir app and sign in — keep that tab open while you capture.
          </p>
          <button
            onClick={() => chrome.tabs.create({ url: `${host}/sign-in` })}
            style={{
              marginTop: 13, width: '100%', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 10, background: C.accent,
              color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
            }}
          >
            <LogIn size={14} />Sign in
          </button>
        </div>
      </div>
      <Divider />
    </>
  )
}

function MiniBtn({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7,
        fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
        background: 'transparent', border: `1px solid ${C.border2}`, color: C.text2,
      }}
    >
      {icon}{children}
    </button>
  )
}

function SyncPill({ lastSyncedMs }: { lastSyncedMs: number | null }) {
  const synced = lastSyncedMs != null
  return (
    <span style={{
      marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
      color: C.text3, fontSize: 11, fontWeight: 500, letterSpacing: '0.01em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: synced ? C.good : C.text4 }} />
      {synced ? `Synced · ${formatRelativeTime(new Date(lastSyncedMs!))}` : 'Not synced yet'}
    </span>
  )
}

function ConsentRow({ icon, title, subtitle, checked, disabled, onChange }: {
  icon: React.ReactNode; title: string; subtitle: string
  checked: boolean; disabled: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 13px',
      background: C.raised, opacity: disabled ? 0.6 : 1,
    }}>
      <span style={{
        width: 28, height: 28, flex: 'none', borderRadius: 8,
        background: 'rgba(255,255,255,0.05)', color: C.text3, display: 'grid', placeItems: 'center',
      }}>
        {icon}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11, color: C.text4, marginTop: 1 }}>{subtitle}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={`Enable ${title} capture`} />
    </div>
  )
}

// Always-visible indicator of HOW matching is running right now, so semantic vs
// keyword-only is never a silent mystery. Mirrors the model's real state.
function MatchModeChip({ ready, degraded }: { ready: boolean | null; degraded: boolean }) {
  if (ready == null) return null // still loading status
  const semantic = ready && !degraded
  const dot = degraded ? C.danger : semantic ? C.good : C.text4
  const label = degraded ? 'Keywords · degraded' : semantic ? 'Semantic matching' : 'Keyword matching'
  return (
    <span
      title={
        degraded
          ? 'The on-device model is failing; matching fell back to keywords.'
          : semantic
            ? 'Pages match by meaning via the on-device model.'
            : 'Matching by keywords only. Enable smart matching for meaning-based matches.'
      }
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 500,
        letterSpacing: '0.02em', color: degraded ? C.danger : C.text3,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      {label}
    </span>
  )
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'left', borderLeft: label === 'Spaces' ? 'none' : `1px solid ${C.border}`, paddingLeft: label === 'Spaces' ? 0 : 15, paddingRight: 15 }}>
      <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: accent ? C.accent2 : C.text }}>
        {value}
      </div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.text4, marginTop: 4 }}>{label}</div>
    </div>
  )
}

function FootBtn({ icon, iconRight, onClick, children }: {
  icon: React.ReactNode; iconRight?: boolean; onClick: () => void; children: React.ReactNode
}) {
  const [hover, setHover] = React.useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 8,
        fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
        background: 'transparent', border: 'none', color: hover ? C.text : C.text3,
      }}
    >
      {!iconRight && icon}
      {children}
      {iconRight && icon}
    </button>
  )
}

function safeHost(url?: string): string {
  if (!url) return ''
  try { return new URL(url).hostname } catch { return url }
}
