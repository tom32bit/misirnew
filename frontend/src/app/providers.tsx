"use client"

import { ClerkProvider } from "@clerk/nextjs"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Toaster } from "sonner"
import { useState } from "react"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
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
          colorPrimary: "#FF6C3C",
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
        {children}
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
