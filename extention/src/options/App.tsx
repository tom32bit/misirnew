import { apiSetConsent } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useDBStatus } from '@/hooks/useDBStatus'
import { useLibraryStatus } from '@/hooks/useLibraryStatus'
import { useBlocklist } from '@/hooks/useBlocklist'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowLeft, CheckCircle, AlertCircle, Loader2, XCircle, ChevronDown, ChevronUp, X, Download, Upload, RefreshCw } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export default function SettingsApp() {
  const { user, loading, signOut } = useAuth()
  const dbStatus = useDBStatus()
  const [cacheRefreshing, setCacheRefreshing] = useState(false)
  const [cacheRefreshResult, setCacheRefreshResult] = useState<'ok' | 'error' | null>(null)
  const libraryStatus = useLibraryStatus()
  const { list: blocklist, add: addBlocked, remove: removeBlocked, reset: resetBlocklist, defaults: defaultBlocklist, setList: setBlocklist } = useBlocklist()
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [importError, setImportError] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)
  const [autoCapture, setAutoCapture] = useState(true)
  const [aiChatCapture, setAiChatCapture] = useState(true)
  const [consent, setConsentState] = useState<{ webCapture: boolean; aiChatCapture: boolean }>({
    webCapture: false,
    aiChatCapture: false,
  })

  useEffect(() => {
    chrome.storage.local.get(['misirAutoCapture', 'misirAIChatCapture', 'misirConsent'], (result) => {
      setAutoCapture(result.misirAutoCapture !== false)
      setAiChatCapture(result.misirAIChatCapture !== false)
      if (result.misirConsent) {
        setConsentState({
          webCapture: !!result.misirConsent.webCapture,
          aiChatCapture: !!result.misirConsent.aiChatCapture,
        })
      }
    })
  }, [])

  function updateConsent(patch: Partial<{ webCapture: boolean; aiChatCapture: boolean }>) {
    const next = { ...consent, ...patch }
    setConsentState(next)
    chrome.storage.local.set({
      misirConsent: { ...next, version: '2026-06-07', grantedAt: Date.now() },
    })
    if (next.webCapture || next.aiChatCapture) chrome.storage.local.remove('misirNeedsConsent')
    // Sync to the backend consent ledger so the server-side capture gate agrees
    // (otherwise opting in here would still be 403'd by the backend).
    apiSetConsent([
      { purpose: 'web_capture', granted: next.webCapture },
      { purpose: 'ai_chat_capture', granted: next.aiChatCapture },
    ]).catch(() => {})
  }

  function forceRefreshCache() {
    setCacheRefreshing(true)
    setCacheRefreshResult(null)
    chrome.runtime.sendMessage({ type: 'FORCE_SYNC_CACHE' }, (response: any) => {
      setCacheRefreshing(false)
      if (response?.ok) {
        setCacheRefreshResult('ok')
        dbStatus.reload()
      } else {
        setCacheRefreshResult('error')
      }
      setTimeout(() => setCacheRefreshResult(null), 3000)
    })
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
          setImportError('Invalid format — expected a JSON array of strings')
          return
        }
        await setBlocklist(parsed as string[])
      } catch {
        setImportError('Could not parse file — must be valid JSON')
      } finally {
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Not signed in</CardTitle>
            <CardDescription>Please sign in to access settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.history.back()} variant="outline" className="w-full">
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your Misir extension preferences</p>
          </div>

          {/* Account Section */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-base font-medium mt-1">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">User ID</label>
                <p className="font-mono text-xs text-muted-foreground mt-1 break-all">{user.id}</p>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Consent */}
          <Card>
            <CardHeader>
              <CardTitle>Privacy &amp; consent</CardTitle>
              <CardDescription>
                Nothing is captured until you turn it on here, and you can withdraw consent at any
                time. See our{' '}
                <a href="https://misir.app/privacy" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Allow capturing web pages</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Save readable text from pages that match your spaces. Off by default.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.webCapture}
                  onChange={(e) => updateConsent({ webCapture: e.target.checked })}
                  className="h-5 w-5 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Allow capturing AI chat conversations</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Save your conversations from supported AI sites. Off by default.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.aiChatCapture}
                  onChange={(e) => updateConsent({ aiChatCapture: e.target.checked })}
                  className="h-5 w-5 cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          {/* Capture Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Capture Settings</CardTitle>
              <CardDescription>
                These only take effect after you grant consent above. They pause/resume capture.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Auto-capture enabled</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Automatically save pages matching your spaces</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoCapture}
                  onChange={(e) => {
                    setAutoCapture(e.target.checked)
                    chrome.storage.local.set({ misirAutoCapture: e.target.checked })
                  }}
                  className="h-5 w-5 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Extract AI chat conversations</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Capture content from ChatGPT, Claude, and other AI services</p>
                </div>
                <input
                  type="checkbox"
                  checked={aiChatCapture}
                  onChange={(e) => {
                    setAiChatCapture(e.target.checked)
                    chrome.storage.local.set({ misirAIChatCapture: e.target.checked })
                  }}
                  className="h-5 w-5 cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          {/* Blocked Sites */}
          <Card>
            <CardHeader>
              <CardTitle>Blocked Sites</CardTitle>
              <CardDescription>Pages from these domains will never be captured</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border divide-y divide-border max-h-64 overflow-y-auto">
                {blocklist.map((domain) => (
                  <div key={domain} className="flex items-center justify-between px-3 py-2 hover:bg-muted/40">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{domain}</span>
                      {defaultBlocklist.includes(domain) && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          default
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => void removeBlocked(domain)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {blocklist.length === 0 && (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">No blocked sites</p>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void addBlocked(newDomain).then(() => setNewDomain(''))
                }}
                className="flex gap-2"
              >
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="example.com"
                  className="h-9 text-sm flex-1"
                />
                <Button type="submit" variant="outline" size="sm" disabled={!newDomain.trim()}>
                  Add
                </Button>
              </form>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => void resetBlocklist()}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Reset to defaults
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportBlocklist} className="h-8 gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()} className="h-8 gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    Import
                  </Button>
                  <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
                </div>
              </div>
              {importError && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <p className="text-xs text-destructive">{importError}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Database Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Database Status</CardTitle>
                  <CardDescription>Local cache synchronization status</CardDescription>
                </div>
                <button
                  onClick={forceRefreshCache}
                  disabled={cacheRefreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Force-refresh cached spaces, subspaces and markers from the backend"
                >
                  {cacheRefreshing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : cacheRefreshResult === 'ok' ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  ) : cacheRefreshResult === 'error' ? (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {cacheRefreshing ? 'Refreshing…' : cacheRefreshResult === 'ok' ? 'Refreshed' : cacheRefreshResult === 'error' ? 'Failed' : 'Refresh cache'}
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                <div className="flex items-center gap-2">
                  {dbStatus.spacesLoading ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Spaces</p>
                    <p className="text-xs text-muted-foreground">{dbStatus.spaces.length} loaded</p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedSection(expandedSection === 'spaces' ? null : 'spaces')}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  {expandedSection === 'spaces' ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
              {expandedSection === 'spaces' && dbStatus.spaces.length > 0 && (
                <div className="pl-3 border-l-2 border-border ml-2 py-2 space-y-1">
                  {dbStatus.spaces.map((space) => (
                    <div key={space.id} className="text-xs">
                      <p className="font-medium text-foreground">{space.name}</p>
                      <p className="text-muted-foreground">{space.description || 'No description'}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                <div className="flex items-center gap-2">
                  {dbStatus.subspacesLoading ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Subspaces</p>
                    <p className="text-xs text-muted-foreground">{dbStatus.subspaces.length} loaded</p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedSection(expandedSection === 'subspaces' ? null : 'subspaces')}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  {expandedSection === 'subspaces' ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
              {expandedSection === 'subspaces' && dbStatus.subspaces.length > 0 && (
                <div className="pl-3 border-l-2 border-border ml-2 py-2 space-y-1">
                  {dbStatus.subspaces.map((subspace) => (
                    <div key={subspace.id} className="text-xs">
                      <p className="font-medium text-foreground">{subspace.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {subspace.description || 'No description'} • {subspace.artifactCount} artifacts
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                <div className="flex items-center gap-2">
                  {dbStatus.markersLoading ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Markers</p>
                    <p className="text-xs text-muted-foreground">{dbStatus.markers.length} loaded</p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedSection(expandedSection === 'markers' ? null : 'markers')}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  {expandedSection === 'markers' ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
              {expandedSection === 'markers' && dbStatus.markers.length > 0 && (
                <div className="pl-3 border-l-2 border-border ml-2 py-2 space-y-1">
                  {dbStatus.markers.map((marker) => (
                    <div key={marker.id} className="text-xs">
                      <p className="font-medium text-foreground">{marker.label}</p>
                      <p className="text-muted-foreground">Weight: {marker.weight}</p>
                    </div>
                  ))}
                </div>
              )}

              {dbStatus.error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <p className="text-xs text-destructive">{dbStatus.error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Library Status */}
          <Card>
            <CardHeader>
              <CardTitle>Libraries Status</CardTitle>
              <CardDescription>Processing modules availability</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                <div className="flex items-center gap-2">
                  {libraryStatus.winkNLP.loading ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  ) : libraryStatus.winkNLP.available ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Wink NLP</p>
                    <p className="text-xs text-muted-foreground">
                      {libraryStatus.winkNLP.loading
                        ? 'Loading...'
                        : libraryStatus.winkNLP.available
                          ? 'Loaded'
                          : libraryStatus.winkNLP.error || 'Not available'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                <div className="flex items-center gap-2">
                  {libraryStatus.readability.loading ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  ) : libraryStatus.readability.available ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Readability</p>
                    <p className="text-xs text-muted-foreground">
                      {libraryStatus.readability.loading
                        ? 'Loading...'
                        : libraryStatus.readability.available
                          ? 'Loaded'
                          : libraryStatus.readability.error || 'Not available'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About Section */}
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">0.1.0</span>
              </div>
              <div className="flex justify-between text-sm pt-3 border-t border-border">
                <a href="https://misir.app" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Visit Website
                </a>
                <a href="https://misir.app/docs" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Documentation
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Sign Out */}
          <div className="flex gap-3">
            <Button
              onClick={() => void signOut()}
              variant="destructive"
              className="flex-1"
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
