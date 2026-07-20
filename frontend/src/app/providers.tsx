"use client"

import { ClerkProvider } from "@clerk/nextjs"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
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

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())

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
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </ClerkProvider>
  )
}
