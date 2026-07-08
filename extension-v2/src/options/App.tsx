import React from 'react'
import {
  Download,
  Trash2,
  Shield,
  LogOut,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Upload,
  Globe,
  Sparkles,
  Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { getConsent, setConsent, gpcOptOut, POLICY_VERSION } from '@/lib/consent'
import { apiExportData, apiDeleteAccount, apiSyncConsent, apiGetMe } from '@/lib/api'
import { getSessionClaims } from '@/lib/auth'
import {
  getBlocklist,
  setBlocklist,
  normalizeDomain,
  DEFAULT_BLOCKLIST,
} from '@/lib/blocklist'
import { db } from '@/lib/db'
import logoUrl from '@/assets/misir-logo.png'

type Counts = { spaces: number; subspaces: number; markers: number }

export function OptionsApp() {
  const [email, setEmail] = React.useState<string | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [signedIn, setSignedIn] = React.useState(false)

  const [webConsent, setWebConsent] = React.useState(false)
  const [aiConsent, setAiConsent] = React.useState(false)

  const [webEnabled, setWebEnabled] = React.useState(true)
  const [aiEnabled, setAiEnabled] = React.useState(true)

  const [blocklist, setBlocklistState] = React.useState<string[]>([])
  const [newDomain, setNewDomain] = React.useState('')
  const [importError, setImportError] = React.useState('')
  const importRef = React.useRef<HTMLInputElement>(null)

  const [counts, setCounts] = React.useState<Counts>({ spaces: 0, subspaces: 0, markers: 0 })
  const [refreshing, setRefreshing] = React.useState(false)
  const [refreshResult, setRefreshResult] = React.useState<'ok' | 'error' | null>(null)

  const [busy, setBusy] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)

  const gpcActive = gpcOptOut()

  React.useEffect(() => {
    load()
  }, [])

  async function load() {
    const [consent, masters, list] = await Promise.all([
      getConsent(),
      chrome.storage.local.get(['misirWebEnabled', 'misirAiEnabled']),
      getBlocklist(),
    ])
    setWebConsent(consent.webCapture)
    setAiConsent(consent.aiChatCapture)
    setWebEnabled(masters.misirWebEnabled !== false)
    setAiEnabled(masters.misirAiEnabled !== false)
    setBlocklistState(list)
    loadAccount()
    loadCounts()
  }

  async function loadAccount() {
    // A local session cookie means we're signed in even if the JWT carries no
    // email claim. The persisted email comes from the backend /me row.
    const claims = await getSessionClaims()
    if (claims?.sub) {
      setSignedIn(true)
      setUserId(claims.sub)
      if (claims.email) setEmail(claims.email)
    }
    try {
      const me = await apiGetMe()
      setSignedIn(true)
      setUserId(me.clerk_user_id || claims?.sub || null)
      setEmail(me.email || claims?.email || null)
    } catch {
      // Offline or token rejected — keep whatever the cookie gave us.
    }
  }

  async function loadCounts() {
    try {
      const [spaces, subspaces, markers] = await Promise.all([
        db.spaces.count(),
        db.subspaces.count(),
        db.markers.count(),
      ])
      setCounts({ spaces, subspaces, markers })
    } catch {
      /* ignore */
    }
  }

  async function toggleConsent(type: 'web' | 'ai', value: boolean) {
    if (gpcActive) return
    if (type === 'web') setWebConsent(value)
    else setAiConsent(value)
    await setConsent({ [type === 'web' ? 'webCapture' : 'aiChatCapture']: value })
    try {
      await apiSyncConsent({
        webCapture: type === 'web' ? value : webConsent,
        aiChatCapture: type === 'ai' ? value : aiConsent,
      })
    } catch {
      /* offline / not signed in */
    }
  }

  async function toggleMaster(type: 'web' | 'ai', value: boolean) {
    if (type === 'web') {
      setWebEnabled(value)
      await chrome.storage.local.set({ misirWebEnabled: value })
    } else {
      setAiEnabled(value)
      await chrome.storage.local.set({ misirAiEnabled: value })
    }
  }

  async function persistBlocklist(next: string[]) {
    setBlocklistState(next)
    await setBlocklist(next)
  }

  async function addDomain(e: React.FormEvent) {
    e.preventDefault()
    const domain = normalizeDomain(newDomain)
    if (!domain || blocklist.includes(domain)) return
    await persistBlocklist([...blocklist, domain])
    setNewDomain('')
  }

  function exportBlocklist() {
    const blob = new Blob([JSON.stringify(blocklist, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'misir-blocklist.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        if (!Array.isArray(parsed) || parsed.some((d) => typeof d !== 'string')) {
          setImportError('Invalid format — expected a JSON array of strings.')
          return
        }
        await persistBlocklist(parsed as string[])
      } catch {
        setImportError('Could not parse file — must be valid JSON.')
      } finally {
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  function refreshCache() {
    setRefreshing(true)
    setRefreshResult(null)
    chrome.runtime.sendMessage({ type: 'FORCE_SYNC_CACHE' }, (resp: any) => {
      setRefreshing(false)
      setRefreshResult(resp?.ok ? 'ok' : 'error')
      if (resp?.ok) loadCounts()
      setTimeout(() => setRefreshResult(null), 3000)
    })
  }

  async function handleExport() {
    setBusy(true)
    setStatus(null)
    try {
      const data = await apiExportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      await chrome.downloads?.download?.({ url, filename: 'misir-data-export.json' })
      setStatus('Export started.')
    } catch {
      setStatus('Export failed — make sure you are signed in.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete your Misir account and all associated data? This cannot be undone.')) return
    setBusy(true)
    setStatus(null)
    try {
      await apiDeleteAccount()
      await chrome.runtime.sendMessage({ type: 'SIGN_OUT' })
      setStatus('Account deletion requested.')
    } catch {
      setStatus('Deletion failed — make sure you are signed in.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setBusy(true)
    await chrome.runtime.sendMessage({ type: 'SIGN_OUT' })
    setStatus('Signed out on this device.')
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--m-app)', color: 'var(--m-text)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 24px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <img src={logoUrl} width={28} height={28} alt="Misir" style={{ borderRadius: 6 }} />
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Settings
          </h1>
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--m-text-3)' }}>
          Manage your Misir extension · policy {POLICY_VERSION}
        </p>

        {/* Account */}
        <Section icon={<Shield className="w-4 h-4" />} title="Account">
          {signedIn ? (
            <>
              <Field label="Email" value={email || 'Signed in'} />
              <Field label="User ID" value={userId ?? '—'} mono />
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--m-text-3)' }}>
              Not signed in.{' '}
              <a href="https://misir.app" target="_blank" rel="noreferrer" style={{ color: 'var(--m-accent)' }}>
                Sign in to Misir
              </a>{' '}
              to sync captures.
            </p>
          )}
        </Section>

        {/* Privacy & consent */}
        <Section icon={<Shield className="w-4 h-4" />} title="Privacy & consent" note="Nothing is captured until you turn it on. Withdraw anytime.">
          {gpcActive && (
            <Banner>Global Privacy Control is on — all capture is disabled.</Banner>
          )}
          <ToggleRow
            icon={<Globe className="w-4 h-4" />}
            title="Capture web pages"
            subtitle="Save readable article text that matches your spaces."
            checked={webConsent}
            disabled={gpcActive}
            onChange={(v) => toggleConsent('web', v)}
          />
          <ToggleRow
            icon={<Sparkles className="w-4 h-4" />}
            title="Capture AI conversations"
            subtitle="Save chats from ChatGPT, Claude, Gemini and more."
            checked={aiConsent}
            disabled={gpcActive}
            onChange={(v) => toggleConsent('ai', v)}
          />
        </Section>

        {/* Capture behaviour */}
        <Section icon={<Sparkles className="w-4 h-4" />} title="Capture behaviour" note="Pause the Misir card on a surface without changing your consent.">
          <ToggleRow
            icon={<Globe className="w-4 h-4" />}
            title="Show Misir on web pages"
            subtitle="Display the save card while browsing articles."
            checked={webEnabled}
            onChange={(v) => toggleMaster('web', v)}
          />
          <ToggleRow
            icon={<Sparkles className="w-4 h-4" />}
            title="Show Misir on AI chats"
            subtitle="Display the save card on AI chat platforms."
            checked={aiEnabled}
            onChange={(v) => toggleMaster('ai', v)}
          />
        </Section>

        {/* Blocked sites */}
        <Section icon={<X className="w-4 h-4" />} title="Blocked sites" note="Pages on these domains are never offered for capture.">
          <div
            style={{
              border: '1px solid var(--m-border)',
              borderRadius: 10,
              overflow: 'hidden',
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {blocklist.length === 0 ? (
              <p style={{ margin: 0, padding: '16px', textAlign: 'center', fontSize: 13, color: 'var(--m-text-3)' }}>No blocked sites</p>
            ) : (
              blocklist.map((domain, i) => (
                <div
                  key={domain}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--m-border)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    {domain}
                    {DEFAULT_BLOCKLIST.includes(domain) && (
                      <span style={{ fontSize: 10, color: 'var(--m-text-3)', background: 'var(--m-hover)', padding: '1px 6px', borderRadius: 999 }}>
                        default
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => persistBlocklist(blocklist.filter((d) => d !== domain))}
                    title="Remove"
                    style={{ display: 'inline-flex', padding: 4, border: 'none', background: 'transparent', color: 'var(--m-text-3)', cursor: 'pointer', borderRadius: 6 }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={addDomain} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              style={{
                flex: 1,
                height: 34,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid var(--m-border)',
                background: 'var(--m-sunken)',
                color: 'var(--m-text)',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <Button type="submit" variant="outline" size="sm" disabled={!newDomain.trim()}>
              Add
            </Button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <button
              onClick={() => persistBlocklist(DEFAULT_BLOCKLIST)}
              style={{ border: 'none', background: 'transparent', color: 'var(--m-text-3)', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}
            >
              Reset to defaults
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" onClick={exportBlocklist}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Import
              </Button>
              <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
            </div>
          </div>
          {importError && <Banner>{importError}</Banner>}
        </Section>

        {/* Local cache */}
        <Section
          icon={<Database className="w-4 h-4" />}
          title="Local cache"
          action={
            <Button variant="outline" size="sm" onClick={refreshCache} disabled={refreshing}>
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : refreshResult === 'ok' ? (
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              ) : refreshResult === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              {refreshing ? 'Refreshing…' : refreshResult === 'ok' ? 'Refreshed' : refreshResult === 'error' ? 'Failed' : 'Refresh'}
            </Button>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Stat label="Spaces" value={counts.spaces} />
            <Stat label="Subspaces" value={counts.subspaces} />
            <Stat label="Markers" value={counts.markers} />
          </div>
        </Section>

        {/* Your data */}
        <Section icon={<Download className="w-4 h-4" />} title="Your data">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button variant="outline" onClick={handleExport} disabled={busy}>
              <Download className="w-4 h-4 mr-2" /> Export my data
            </Button>
            <Button variant="outline" onClick={handleSignOut} disabled={busy}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out (this device)
            </Button>
            <Separator style={{ background: 'var(--m-border)' }} />
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete account & data
            </Button>
            {status && <p style={{ margin: 0, fontSize: 13, color: 'var(--m-text-3)' }}>{status}</p>}
          </div>
        </Section>

        {/* About */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--m-text-3)' }}>
          <span>Misir v2.0</span>
          <span style={{ display: 'flex', gap: 16 }}>
            <a href="https://misir.app" target="_blank" rel="noreferrer" style={{ color: 'var(--m-accent)' }}>Website</a>
            <a href="https://misir.app/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--m-accent)' }}>Privacy</a>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Presentational helpers ───────────────────────────────────────────────────

function Section({
  icon,
  title,
  note,
  action,
  children,
}: {
  icon: React.ReactNode
  title: string
  note?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        marginBottom: 16,
        padding: 16,
        borderRadius: 14,
        background: 'var(--m-raised)',
        border: '1px solid var(--m-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: note ? 4 : 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--m-text)' }}>
          <span style={{ color: 'var(--m-accent)' }}>{icon}</span>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h2>
        </div>
        {action}
      </div>
      {note && <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--m-text-3)', lineHeight: 1.5 }}>{note}</p>}
      {children}
    </div>
  )
}

function ToggleRow({
  icon,
  title,
  subtitle,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderTop: '1px solid var(--m-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ display: 'inline-flex', width: 28, height: 28, flex: 'none', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'var(--m-accent-soft)', color: 'var(--m-accent)' }}>
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{title}</p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--m-text-3)' }}>{subtitle}</p>
        </div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--m-text-3)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, wordBreak: 'break-all', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{value}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: '12px', borderRadius: 10, background: 'var(--m-sunken)', border: '1px solid var(--m-border)', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{value}</p>
      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--m-text-3)' }}>{label}</p>
    </div>
  )
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '0 0 12px',
        padding: '9px 11px',
        borderRadius: 8,
        background: 'var(--m-danger-soft)',
        border: `1px solid var(--m-danger)`,
        fontSize: 12,
      }}
    >
      <AlertCircle className="w-4 h-4" style={{ flex: 'none', color: 'var(--m-danger)' }} />
      {children}
    </div>
  )
}
