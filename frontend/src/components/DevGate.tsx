"use client"

import { useEffect, useState } from "react"

/**
 * Lightweight access gate for non-production deployments (e.g. a Vercel preview).
 * Renders a password screen instead of the app until the correct developer
 * password is entered. It compares a SHA-256 hash of the input against
 * NEXT_PUBLIC_DEV_GATE_HASH, so the plaintext password is never shipped in the
 * bundle. When the env var is unset (local dev), the gate is disabled.
 *
 * This is a soft gate to keep casual visitors out of a shared preview — not a
 * security boundary. Real auth is still Clerk, behind this screen.
 */

const COOKIE = "misir_dev_gate"
const EXPECTED_HASH = process.env.NEXT_PUBLIC_DEV_GATE_HASH ?? ""

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function DevGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "locked" | "unlocked">("loading")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // No hash configured → not gating (local dev).
    if (!EXPECTED_HASH) {
      setStatus("unlocked")
      return
    }
    const unlocked = document.cookie
      .split("; ")
      .some((c) => c === `${COOKIE}=${EXPECTED_HASH}`)
    setStatus(unlocked ? "unlocked" : "locked")
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(false)
    const hash = await sha256Hex(password)
    if (hash === EXPECTED_HASH) {
      // Persist for 30 days so devs aren't re-prompted every visit.
      document.cookie = `${COOKIE}=${EXPECTED_HASH}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
      setStatus("unlocked")
    } else {
      setError(true)
      setSubmitting(false)
      setPassword("")
    }
  }

  // Avoid a hydration flash: render nothing until we know the state.
  if (status === "loading") return null
  if (status === "unlocked") return <>{children}</>

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #191919)",
        color: "var(--fg, #fafafa)",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--bg-subtle, #262625)",
          border: "1px solid var(--border-strong, #40403e)",
          borderRadius: 14,
          padding: 28,
          boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/misir-logo.png" width={26} height={26} alt="Misir" style={{ borderRadius: 6 }} />
          <span
            style={{
              fontFamily: "var(--font-display, Georgia, serif)",
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Misir
          </span>
        </div>

        <h1 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600 }}>Preview access</h1>
        <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.5, color: "var(--fg-muted, #a1a1aa)" }}>
          This is a private preview. Enter the developer password to continue.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Developer password"
          autoFocus
          autoComplete="off"
          aria-label="Developer password"
          style={{
            width: "100%",
            boxSizing: "border-box",
            height: 40,
            padding: "0 12px",
            borderRadius: 8,
            border: `1px solid ${error ? "var(--state-error, #bf4d43)" : "var(--border-strong, #40403e)"}`,
            background: "var(--bg, #191919)",
            color: "var(--fg, #fafafa)",
            fontSize: 14,
            outline: "none",
          }}
        />

        {error && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--state-error, #bf4d43)" }}>
            Incorrect password.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || password.length === 0}
          style={{
            width: "100%",
            marginTop: 16,
            height: 40,
            border: "none",
            borderRadius: 8,
            background: "var(--accent, #d97757)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting || password.length === 0 ? "default" : "pointer",
            opacity: submitting || password.length === 0 ? 0.7 : 1,
          }}
        >
          {submitting ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  )
}
