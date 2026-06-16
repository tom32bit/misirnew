import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

const FRONTEND_URL = (import.meta.env.VITE_CLERK_SYNC_HOST as string) || 'http://localhost:3000'

interface EngagementSnapshot {
  dwellTimeMs: number
  scrollDepth: number
  readingDepth: number
  engagementLevel: string
  baseWeight: number
}

interface EngagementState {
  snapshot: EngagementSnapshot | null
  remoteId: number | null
  url: string
}

function fmtDwell(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

export default function PopupApp() {
  const { user, loading, signOut } = useAuth()
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [engagement, setEngagement] = useState<EngagementState | null>(null)
  const [needsOptIn, setNeedsOptIn] = useState(false)

  // Show an opt-in notice whenever the user hasn't enabled any capture, or the
  // backend reported that consent is required.
  useEffect(() => {
    const check = () =>
      chrome.storage.local.get(['misirConsent', 'misirNeedsConsent'], (r) => {
        const c = r.misirConsent
        const consented = !!(c && (c.webCapture || c.aiChatCapture))
        setNeedsOptIn(!consented || !!r.misirNeedsConsent)
      })
    check()
    const id = setInterval(check, 1500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      chrome.runtime.sendMessage({ type: 'GET_DEBUG_LOGS' }, (response: any) => {
        if (response?.logs) setLogs(response.logs)
      })
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        if (!tabId) return
        chrome.tabs.sendMessage(tabId, { type: 'GET_ENGAGEMENT_SNAPSHOT' }, (response: any) => {
          if (chrome.runtime.lastError) return
          if (response) setEngagement(response)
        })
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="w-full p-6 flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="w-full p-6 flex flex-col gap-3">
        <p className="text-sm font-semibold">Sign in to Misir</p>
        <p className="text-xs text-muted-foreground">
          Sign into the Misir dashboard, then return here — the extension will pick up your session automatically.
        </p>
        <button
          onClick={async () => {
            await chrome.storage.local.remove(['misirSignedOutSid'])
            chrome.tabs.create({ url: `${FRONTEND_URL}/sign-in` })
          }}
          className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          Open Sign-in Page →
        </button>
      </div>
    )
  }

  const avatarLetter = (user.email?.[0] ?? 'M').toUpperCase()

  return (
    <div className="w-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <p className="text-base font-semibold">Welcome to Misir</p>
          <p className="text-xs text-muted-foreground">You're signed in</p>
        </div>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* User info */}
      <div className="border-b">
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/50">
          <div className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center text-background text-sm font-semibold shrink-0">
            {avatarLetter}
          </div>
          <p className="text-sm truncate">{user.email}</p>
        </div>
        <div className="px-4 py-3">
          <button
            onClick={signOut}
            className="w-full py-2 text-sm border rounded-md hover:bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Opt-in notice — shown until the user enables capture */}
      {needsOptIn && (
        <div className="p-3 border-b bg-amber-50 dark:bg-amber-950/30">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Capture is off</p>
          <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-400/80 mt-0.5">
            Opt in to let Misir save pages and AI chats that match your spaces. You can change this
            anytime in Settings.
          </p>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="mt-2 w-full py-1.5 text-xs font-medium bg-amber-600 text-white rounded-md hover:opacity-90"
          >
            Review &amp; opt in →
          </button>
        </div>
      )}

      {/* Engagement Stats */}
      {engagement?.snapshot ? (
        <div className="p-3 border-b bg-muted/30">
          <p className="text-xs font-medium mb-2">Current Page Engagement</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Time spent</span>
              <span className="text-xs font-mono font-medium">{fmtDwell(engagement.snapshot.dwellTimeMs)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Level</span>
              <span className={`text-xs font-mono font-semibold ${
                engagement.snapshot.engagementLevel === 'deep' ? 'text-green-600' :
                engagement.snapshot.engagementLevel === 'active' ? 'text-blue-600' :
                engagement.snapshot.engagementLevel === 'passive' ? 'text-yellow-600' :
                'text-muted-foreground'
              }`}>{engagement.snapshot.engagementLevel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Scroll depth</span>
              <span className="text-xs font-mono font-medium">{(engagement.snapshot.scrollDepth * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Reading depth</span>
              <span className="text-xs font-mono font-medium">{(Math.min(engagement.snapshot.readingDepth, 1) * 100).toFixed(0)}%</span>
            </div>
          </div>
          {engagement.remoteId && (
            <p className="text-[10px] text-muted-foreground mt-1.5">artifact #{engagement.remoteId}</p>
          )}
        </div>
      ) : (
        <div className="px-3 py-2 border-b">
          <p className="text-xs text-muted-foreground">No tracked page active</p>
        </div>
      )}

      {/* Debug Logs — unchanged */}
      {showLogs && (
        <div className="p-3 max-h-48 overflow-y-auto border-b bg-slate-50 dark:bg-slate-900">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium">Debug Logs</span>
            <button onClick={() => setShowLogs(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <div className="space-y-1">
            {logs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No logs yet</p>
            ) : (
              logs.map((l, i) => (
                <p key={i} className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">{l}</p>
              ))
            )}
          </div>
        </div>
      )}
      {!showLogs && (
        <button
          onClick={() => setShowLogs(true)}
          className="w-full p-2 text-xs text-muted-foreground hover:bg-muted"
        >
          Show Debug Logs
        </button>
      )}
    </div>
  )
}
