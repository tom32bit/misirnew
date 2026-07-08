/**
 * Toolbar component - floating "Save to Misir" button
 * Injected into AI chat pages
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import { Save, Loader2, Check, SearchX, Sparkles } from 'lucide-react'
import { detectPlatform } from './platform-detector'
import { WarningModal } from './warning-modal'

// Result of a save attempt, surfaced in the pill after the background responds.
export interface SaveOutcome {
  status: 'saved' | 'nomatch'
  spaceName?: string
  subspaceName?: string
  /** 0–1 relevance score from the matcher. */
  confidence?: number
}

// Live best-match shown before the user clicks save.
export interface MatchPreview {
  spaceName?: string
  subspaceName?: string
  confidence?: number
}

interface ToolbarProps {
  onSaveClick: () => void
  isVisible: boolean
  isSaving: boolean
  outcome?: SaveOutcome | null
  preview?: MatchPreview | null
  checking?: boolean
}

// A shadcn-style card, but implemented as scoped, prefixed CSS injected into the
// page. Real shadcn components are Tailwind classes resolved against the app's
// globals.css — unavailable in a content script, and injecting Tailwind's reset
// into the host page (ChatGPT) would wreck its styling. These design tokens mirror
// shadcn (card/border/muted-foreground) and adapt to the host's light/dark theme.
const CARD_CSS = `
#misir-toolbar {
  --m-bg: #ffffff; --m-fg: #09090b; --m-muted: #71717a;
  --m-border: rgba(0,0,0,.10); --m-track: rgba(0,0,0,.08);
  --m-badge-bg: #dcfce7; --m-badge-fg: #15803d;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  #misir-toolbar {
    --m-bg: #0b0b0e; --m-fg: #fafafa; --m-muted: #a1a1aa;
    --m-border: rgba(255,255,255,.12); --m-track: rgba(255,255,255,.12);
    --m-badge-bg: rgba(34,197,94,.16); --m-badge-fg: #4ade80;
  }
}
.misir-card, .misir-card * { box-sizing: border-box; }
.misir-card {
  width: 288px;
  background: var(--m-bg); color: var(--m-fg);
  border: 1px solid var(--m-border); border-radius: 14px; padding: 14px;
  box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 14px 36px -14px rgba(0,0,0,.4);
  animation: misir-pop .24s cubic-bezier(.2,.8,.2,1);
}
.misir-card__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; }
.misir-card__label { display: inline-flex; align-items: center; gap: 6px; min-width: 0; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--m-muted); }
.misir-card__label svg { width: 13px; height: 13px; flex: none; }
.misir-card--spin .misir-card__label svg { animation: misir-spin .9s linear infinite; }
.misir-card__score { flex: none; padding: 2px 9px; border-radius: 9999px; background: var(--m-badge-bg); color: var(--m-badge-fg); font-size: 11px; font-weight: 700; }
.misir-card__space { font-size: 14px; font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.misir-card__sub { margin-top: 2px; font-size: 12px; color: var(--m-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.misir-card__empty { font-size: 12.5px; line-height: 1.45; color: var(--m-muted); }
.misir-card__meter { margin-top: 11px; height: 6px; border-radius: 9999px; background: var(--m-track); overflow: hidden; }
.misir-card__meter-fill { height: 100%; border-radius: inherit; background: var(--misir-accent); transition: width .4s cubic-bezier(.2,.8,.2,1); }
.misir-btn {
  margin-top: 12px; width: 100%; height: 36px;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  border: none; border-radius: 9px;
  background: var(--misir-accent); color: #fff; font-size: 13px; font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.16);
  transition: filter .15s, transform .1s;
}
.misir-btn:hover { filter: brightness(1.07); }
.misir-btn:active { transform: translateY(1px); }
.misir-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--m-bg), 0 0 0 4px var(--misir-accent); }
.misir-btn[disabled] { cursor: default; opacity: .9; }
.misir-btn svg { width: 15px; height: 15px; }
.misir-btn--spin svg { animation: misir-spin .9s linear infinite; }
.misir-saved { margin-top: 12px; display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--m-badge-fg); }
.misir-saved svg { width: 15px; height: 15px; }
@keyframes misir-spin { to { transform: rotate(360deg); } }
@keyframes misir-pop { from { opacity: 0; transform: translateY(8px) scale(.96); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .misir-card { animation: none; }
  .misir-card__meter-fill, .misir-btn { transition: none; }
}
`

function ToolbarComponent({ onSaveClick, isVisible, isSaving, outcome, preview, checking }: ToolbarProps) {
  const [showWarning, setShowWarning] = React.useState(false)

  const platformInfo = detectPlatform(window.location.href)
  const platform = platformInfo?.platform || 'web'

  if (!isVisible) return null

  const handleClick = () => {
    if (platform !== 'web') {
      setShowWarning(true)
    } else {
      onSaveClick()
    }
  }

  if (showWarning) {
    return (
      <WarningModal
        platform={platform}
        onProceed={() => {
          setShowWarning(false)
          onSaveClick()
        }}
        onCancel={() => setShowWarning(false)}
      />
    )
  }

  const saved = outcome?.status === 'saved'
  const nomatch = outcome?.status === 'nomatch'
  // The match info shown in the card: the confirmed result after a save, else
  // the live preview while idle.
  const info = saved ? outcome : !outcome && !isSaving ? preview : null
  const hasMatch = info?.confidence != null
  const pct = hasMatch ? Math.round(info!.confidence! * 100) : null
  // Computing the initial match (before any result exists yet).
  const isChecking = !!checking && !hasMatch && !saved && !nomatch && !isSaving

  // Always the Claude clay accent — the card lives on the dark brand, so the
  // primary action should read as clay, not the host platform's colour.
  const accent = '#D97757'
  const spinning = isSaving || isChecking

  const headLabel = isSaving
    ? 'Saving'
    : saved
      ? 'Saved'
      : nomatch
        ? 'No match'
        : hasMatch
          ? 'Best match'
          : isChecking
            ? 'Checking'
            : 'Misir'
  const headIcon = spinning ? <Loader2 /> : saved ? <Check /> : nomatch ? <SearchX /> : <Sparkles />

  return (
    <div
      id="misir-toolbar"
      style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2147483647 }}
    >
      <style dangerouslySetInnerHTML={{ __html: CARD_CSS }} />

      <div
        className={`misir-card${spinning ? ' misir-card--spin' : ''}`}
        style={{ ['--misir-accent' as string]: accent } as React.CSSProperties}
      >
        <div className="misir-card__head">
          <span className="misir-card__label">{headIcon}{headLabel}</span>
          {pct != null && <span className="misir-card__score">{pct}% match</span>}
        </div>

        {hasMatch ? (
          <>
            <div className="misir-card__space" title={info!.spaceName}>{info!.spaceName || 'Your library'}</div>
            {info!.subspaceName && <div className="misir-card__sub" title={info!.subspaceName}>{info!.subspaceName}</div>}
            <div className="misir-card__meter">
              <div className="misir-card__meter-fill" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <div className="misir-card__empty">
            {nomatch
              ? 'No space matched this page, so nothing was saved.'
              : isChecking
                ? 'Checking this page against your spaces…'
                : 'We’ll match this to your spaces.'}
          </div>
        )}

        {saved ? (
          <div className="misir-saved"><Check />Saved to your library</div>
        ) : nomatch ? null : (
          <button
            className={`misir-btn${isSaving ? ' misir-btn--spin' : ''}`}
            onClick={handleClick}
            disabled={isSaving}
            aria-label="Save this page to Misir"
          >
            {isSaving ? <Loader2 /> : <Save />}
            {isSaving ? 'Saving…' : 'Save to Misir'}
          </button>
        )}
      </div>
    </div>
  )
}

let toolbarRoot: ReturnType<typeof createRoot> | null = null
let toolbarContainer: HTMLDivElement | null = null
let isVisible = false
let isSaving = false
let outcome: SaveOutcome | null = null
let preview: MatchPreview | null = null
let checking = false
let outcomeTimer: ReturnType<typeof setTimeout> | null = null
// Hold the real save handler at module scope so every re-render reuses it.
// (Previously each state change re-rendered with a no-op, disabling the button.)
let onSaveClickRef: () => void = () => {}

export function initToolbar(onSaveClick: () => void): void {
  onSaveClickRef = onSaveClick
  if (toolbarContainer) return

  toolbarContainer = document.createElement('div')
  toolbarContainer.id = 'misir-toolbar-container'
  document.documentElement.appendChild(toolbarContainer)

  toolbarRoot = createRoot(toolbarContainer)
  renderToolbar()
}

function renderToolbar(): void {
  if (!toolbarRoot) return
  toolbarRoot.render(
    <ToolbarComponent
      onSaveClick={onSaveClickRef}
      isVisible={isVisible}
      isSaving={isSaving}
      outcome={outcome}
      preview={preview}
      checking={checking}
    />
  )
}

export function showToolbar(): void {
  isVisible = true
  renderToolbar()
}

export function hideToolbar(): void {
  isVisible = false
  renderToolbar()
}

export function setToolbarSaving(saving: boolean): void {
  isSaving = saving
  if (saving) outcome = null // clear any previous result while a new save runs
  renderToolbar()
}

// Live best-match shown in the idle pill before the user clicks. Pass null to clear.
export function setToolbarPreview(next: MatchPreview | null): void {
  preview = next
  renderToolbar()
}

// Whether an initial match is being computed (shows a "Checking…" state).
export function setToolbarChecking(next: boolean): void {
  if (checking === next) return
  checking = next
  renderToolbar()
}

// Show the result of a save attempt (match score + space, or a no-match notice),
// then revert the pill to its idle state after a few seconds.
export function setToolbarOutcome(next: SaveOutcome): void {
  outcome = next
  isSaving = false
  if (outcomeTimer) clearTimeout(outcomeTimer)
  renderToolbar()

  outcomeTimer = setTimeout(() => {
    outcome = null
    outcomeTimer = null
    renderToolbar()
  }, next.status === 'saved' ? 5000 : 4000)
}

export function destroyToolbar(): void {
  if (toolbarRoot) {
    toolbarRoot.unmount()
    toolbarRoot = null
  }
  if (toolbarContainer) {
    toolbarContainer.remove()
    toolbarContainer = null
  }
}