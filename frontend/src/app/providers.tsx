"use client"

import { ClerkProvider, useAuth } from "@clerk/nextjs"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { MotionConfig } from "motion/react"
import { Toaster } from "sonner"
import { useState } from "react"
import { PostHogIdentify } from "@/components/analytics/PostHogIdentify"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Dashboard payloads are LLM-synthesised server-side and cached there by
        // content hash, so re-asking within a couple of minutes returns the same
        // bytes. Holding them here means moving between spaces and views is
        // instant instead of a round trip each time.
        staleTime: 120_000,
        // Keep them past unmount: navigating away and back should paint from
        // cache and revalidate behind the scenes, not fall back to a skeleton.
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        // ky already retries transport failures (see lib/api/retry.ts). This is
        // the outer layer for anything that surfaces as a rejected promise —
        // notably a cold start that outlives ky's own attempts. Capped, with
        // backoff, so a genuinely-down backend still surfaces reasonably fast.
        retry: 2,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
      },
      mutations: { retry: 0 },
    },
  })
}

/** localStorage persister. Undefined storage on the server → a safe no-op. */
function makePersister() {
  return createSyncStoragePersister({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    key: "misir-query-cache",
    throttleTime: 1_000,
  })
}

const CACHE_MAX_AGE = 30 * 60_000 // mirror gcTime — don't hydrate staler than we'd keep

/**
 * Bridges Clerk auth into the query cache's persistence.
 *
 * Persisting to localStorage is what lets a reload paint from cache instead of
 * hitting the backend every time. But the cache holds one user's synthesised
 * research, and localStorage is shared across accounts on the same browser — so
 * `buster: userId` scopes it: signing in as someone else busts the previous
 * user's cache instead of showing it to them.
 *
 * Gated on `isLoaded`: before Clerk resolves the user we render a plain
 * provider with no persistence. Restoring an "anon" cache first and then
 * busting it the instant userId arrived would refetch on every load — the exact
 * thing persistence is meant to prevent.
 */
function AuthScopedQuery({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth()
  const [client] = useState(makeQueryClient)
  const [persister] = useState(makePersister)

  const extras = (
    <>
      {/* Syncs the PostHog person with the Clerk session (identify/reset). */}
      <PostHogIdentify />
      {/* Honors the OS "reduce motion" setting for all transform/layout
          animations app-wide; value-based sweeps opt in via useReducedMotion. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <Toaster
        position="bottom-right"
        theme="system"
        toastOptions={{
          style: {
            background: "var(--bg)",
            color: "var(--fg)",
            border: "1px solid var(--border-strong)",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
          },
        }}
      />
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </>
  )

  if (!isLoaded) {
    return <QueryClientProvider client={client}>{extras}</QueryClientProvider>
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: userId ?? "anon",
        // Only persist settled, successful results — never an error or a
        // half-loaded cold-start attempt.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === "success",
        },
      }}
    >
      {extras}
    </PersistQueryClientProvider>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#D97757",
          colorBackground: "var(--bg)",
          colorText: "var(--fg)",
          colorTextSecondary: "var(--fg-muted)",
          colorInputBackground: "var(--bg)",
          colorInputText: "var(--fg)",
          borderRadius: "6px",
          fontFamily: "var(--font-sans)",
        },
      }}
    >
      <AuthScopedQuery>{children}</AuthScopedQuery>
    </ClerkProvider>
  )
}
