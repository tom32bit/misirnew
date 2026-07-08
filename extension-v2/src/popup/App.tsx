import React from 'react'
import { Settings, ExternalLink, Loader2, ShieldAlert, RefreshCw, Globe, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { getConsent, setConsent, gpcOptOut } from '@/lib/consent'
import { apiGetConsent, apiSyncConsent } from '@/lib/api'
import { getPendingCount } from '@/lib/db'
import { formatRelativeTime } from '@/lib/utils'
import logoUrl from '@/assets/misir-logo.png'

const SECTION_LABEL: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--m-text-3)',
}

export function PopupApp() {
  const [webConsent, setWebConsent] = React.useState(false)
  const [aiConsent, setAiConsent] = React.useState(false)
  const [pending, setPending] = React.useState(0)
  const [lastSyncedMs, setLastSyncedMs] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      const [consent, count] = await Promise.all([getConsent(), getPendingCount()])
      setWebConsent(consent.webCapture)
      setAiConsent(consent.aiChatCapture)
      setPending(count)
      try {
        await apiGetConsent()
      } catch {
        /* offline or not signed in — local consent still governs the UI */
      }
    } catch (err) {
      console.error('Failed to load initial data:', err)
    } finally {
      setLoading(false)
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
    width: 360,
    background: 'var(--m-app)',
    color: 'var(--m-text)',
    fontFamily: 'var(--font-sans)',
  }

  if (loading) {
    return (
      <div style={{ ...shell, padding: 32, textAlign: 'center' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ margin: '0 auto', color: 'var(--m-accent)' }} />
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--m-text-2)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={shell}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '16px 16px 14px',
          borderBottom: '1px solid var(--m-border)',
        }}
      >
        <img src={logoUrl} width={24} height={24} alt="Misir" style={{ borderRadius: 6 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1 }}>
            Misir
          </div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--m-text-3)' }}>v2.0</span>
      </div>

      {/* Capture consent */}
      <div style={{ padding: 16 }}>
        <h2 style={SECTION_LABEL}>Capture</h2>

        {gpcActive && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              padding: '9px 11px',
              borderRadius: 8,
              background: 'var(--m-danger-soft)',
              border: '1px solid var(--m-danger)',
              fontSize: 12,
              color: 'var(--m-text)',
            }}
          >
            <ShieldAlert className="w-4 h-4" style={{ flex: 'none', color: 'var(--m-danger)' }} />
            Global Privacy Control is on — capture disabled.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ConsentRow
            icon={<Globe className="w-4 h-4" />}
            title="Web pages"
            subtitle="Articles, docs & blogs"
            checked={webConsent}
            disabled={gpcActive || saving}
            onChange={(v) => handleConsentChange('web', v)}
          />
          <ConsentRow
            icon={<Sparkles className="w-4 h-4" />}
            title="AI conversations"
            subtitle="ChatGPT, Claude, Gemini…"
            checked={aiConsent}
            disabled={gpcActive || saving}
            onChange={(v) => handleConsentChange('ai', v)}
          />
        </div>

        <p style={{ margin: '12px 0 0', fontSize: 11, lineHeight: 1.5, color: 'var(--m-text-3)' }}>
          Off by default. Consent is stored on-device and synced to your account.
        </p>
      </div>

      <Separator style={{ background: 'var(--m-border)' }} />

      {/* Sync status */}
      <div style={{ padding: 16 }}>
        <h2 style={SECTION_LABEL}>Sync</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatTile label="Last sync" value={lastSyncedMs ? formatRelativeTime(new Date(lastSyncedMs)) : 'Never'} />
          <StatTile label="Pending" value={`${pending} item${pending !== 1 ? 's' : ''}`} />
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              setLastSyncedMs(Date.now())
              chrome.runtime.sendMessage({ type: 'FORCE_SYNC_CACHE' })
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Sync now
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => chrome.runtime.openOptionsPage()}>
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            Settings
          </Button>
        </div>
      </div>

      <Separator style={{ background: 'var(--m-border)' }} />

      {/* Footer */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
        <Button variant="ghost" size="sm" className="flex-1" onClick={() => chrome.tabs.create({ url: 'https://misir.app/privacy' })}>
          Privacy
        </Button>
        <Button variant="ghost" size="sm" className="flex-1" onClick={() => chrome.tabs.create({ url: 'https://misir.app' })}>
          Open app
          <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  )
}

function ConsentRow({
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
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        borderRadius: 10,
        background: 'var(--m-raised)',
        border: '1px solid var(--m-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            flex: 'none',
            borderRadius: 8,
            background: 'var(--m-accent-soft)',
            color: 'var(--m-accent)',
          }}
        >
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{title}</p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--m-text-3)' }}>{subtitle}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={`Enable ${title} capture`} />
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 12px 13px', borderRadius: 10, background: 'var(--m-raised)', border: '1px solid var(--m-border)' }}>
      <p style={{ margin: '0 0 5px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--m-text-3)' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{value}</p>
    </div>
  )
}
