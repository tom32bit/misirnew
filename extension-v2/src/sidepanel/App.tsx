import { useEffect, useState } from 'react'
import { createConsola } from 'consola'
import { db, getSubspacesWithMarkers } from '@/lib/db'
import { RefreshCw, ChevronRight, Globe, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import logoUrl from '@/assets/misir-logo.png'

const log = createConsola({ level: 4 }).withTag('sidepanel')

interface SubspaceRow {
  id: number
  name: string
  spaceName: string
}

export function SidePanelApp() {
  const [subspaces, setSubspaces] = useState<SubspaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingPage, setSavingPage] = useState(false)
  const [saveNote, setSaveNote] = useState<string | null>(null)

  // "Save page" must go to the ACTIVE TAB's content script (which has the page
  // DOM), not the service worker — the SW's CAPTURE_PAGE handler runs on an empty
  // payload and silently no-ops.
  async function handleSavePage() {
    if (savingPage) return
    setSavingPage(true)
    setSaveNote(null)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) throw new Error('no active tab')
      const res = (await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_PAGE' })) as { ok?: boolean }
      setSaveNote(res?.ok ? 'Saved this page.' : 'Nothing to save on this page.')
    } catch {
      setSaveNote("Can’t save here — open an article, then try again.")
    } finally {
      setSavingPage(false)
      setTimeout(() => setSaveNote(null), 4000)
    }
  }

  useEffect(() => {
    loadSubspaces()
  }, [])

  async function loadSubspaces() {
    setLoading(true)
    setError(null)
    try {
      const [subs, spaces] = await Promise.all([getSubspacesWithMarkers(), db.spaces.toArray()])
      const spaceName = new Map(spaces.map((s) => [s.id, s.name]))
      setSubspaces(
        subs.map((s) => ({ id: s.id, name: s.name, spaceName: spaceName.get(s.spaceId) ?? '' })),
      )
    } catch (err) {
      setError('Failed to load spaces')
      log.error('Load subspaces failed:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setLoading(true)
    try {
      await chrome.runtime.sendMessage({ type: 'FORCE_SYNC_CACHE' })
      await loadSubspaces()
    } catch (err) {
      setError('Sync failed')
      log.error('Sync failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const shell: React.CSSProperties = {
    width: 380,
    minHeight: '100vh',
    background: 'var(--m-app)',
    color: 'var(--m-text)',
    fontFamily: 'var(--font-sans)',
  }

  if (loading && subspaces.length === 0) {
    return (
      <div style={{ ...shell, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
        <RefreshCw className="w-7 h-7 animate-spin" style={{ color: 'var(--m-accent)' }} />
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--m-text-2)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={shell}>
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'var(--m-app)',
          borderBottom: '1px solid var(--m-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logoUrl} width={22} height={22} alt="Misir" style={{ borderRadius: 5 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Spaces
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSync} disabled={loading} aria-label="Sync">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div style={{ padding: 12 }}>
        {error && (
          <div
            style={{
              padding: '9px 11px',
              marginBottom: 12,
              borderRadius: 8,
              background: 'var(--m-danger-soft)',
              border: '1px solid var(--m-danger)',
              color: 'var(--m-text)',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {subspaces.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--m-text-2)' }}>
            <FolderOpen className="w-7 h-7" style={{ margin: '0 auto 10px', color: 'var(--m-text-3)' }} />
            <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--m-text)' }}>No spaces yet</p>
            <p style={{ margin: 0, fontSize: 12 }}>
              Create one in the{' '}
              <a href="https://misir.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--m-accent)' }}>
                Misir app
              </a>
              .
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subspaces.map((s) => (
              <button
                key={s.id}
                onClick={() => chrome.tabs.create({ url: 'https://misir.app' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '11px 12px',
                  borderRadius: 10,
                  background: 'var(--m-raised)',
                  border: '1px solid var(--m-border)',
                  color: 'var(--m-text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--m-border-strong)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--m-border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ width: 7, height: 7, flex: 'none', borderRadius: '50%', background: 'var(--m-accent)' }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </p>
                    {s.spaceName && (
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--m-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.spaceName}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" style={{ flex: 'none', color: 'var(--m-text-3)' }} />
              </button>
            ))}
          </div>
        )}

        <Separator style={{ margin: '14px 0', background: 'var(--m-border)' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1.5" disabled={savingPage} onClick={handleSavePage}>
            <Globe className="w-5 h-5" />
            <span style={{ fontSize: 12 }}>{savingPage ? 'Saving…' : 'Save page'}</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1.5" onClick={() => chrome.runtime.openOptionsPage()}>
            <FolderOpen className="w-5 h-5" />
            <span style={{ fontSize: 12 }}>Settings</span>
          </Button>
        </div>
        {saveNote && (
          <p style={{ margin: '10px 0 0', fontSize: 11.5, textAlign: 'center', color: 'var(--m-text-3)' }}>
            {saveNote}
          </p>
        )}
      </div>
    </div>
  )
}
