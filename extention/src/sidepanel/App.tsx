import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { apiGetArtifacts } from '@/lib/api'
import { db } from '@/lib/db'
import type { Space, Subspace } from '@/types'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function CapturesList() {
  const [spaces, setSpaces] = useState<Map<number, Space>>(new Map())

  useEffect(() => {
    db.spaces.toArray().then((s) => setSpaces(new Map(s.map((x) => [x.id, x]))))
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['artifacts'],
    queryFn: () => apiGetArtifacts({ limit: 50, period: 'month' }) as Promise<any[]>,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive px-4 py-3">Failed to load captures.</p>
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6 py-12">
        <p className="text-sm text-muted-foreground">
          No captures yet. Browse pages that match your spaces and Misir will save them automatically.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {data.map((artifact: any) => {
        const space = spaces.get(artifact.space_id)
        return (
          <li key={artifact.id} className="px-4 py-3 flex flex-col gap-1 hover:bg-muted/40 transition-colors">
            <a
              href={artifact.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium leading-snug line-clamp-2 hover:underline"
            >
              {artifact.title || 'Untitled'}
            </a>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              {space && <span className="font-medium text-foreground/70">{space.name}</span>}
              <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#0001' }}>
                {artifact.platform}
              </span>
              <span className="ml-auto shrink-0">
                {artifact.captured_at && timeAgo(artifact.captured_at)}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function AppContent() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center text-center px-8">
        <p className="text-sm text-muted-foreground">
          Sign in via the Misir extension popup to start capturing.
        </p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <h1 className="text-sm font-semibold">Misir</h1>
        <button
          onClick={() => void signOut()}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <CapturesList />
      </div>
    </div>
  )
}

export default function SidepanelApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
