"use client"

import type { KeyTension } from "@/lib/api/types"
import { platformLabel } from "@/lib/constants/surface-icons"
import type { SourceVM } from "./ComparisonView"

/**
 * Orange-tinted "Conflicting take" card. Prefers the backend's structured
 * `key_tension` (per-source points + edge + meta) — the model's actual read of
 * where the sources diverge. Falls back to synthesising rows from each source's
 * `signal` for reports cached before key_tension existed.
 */
export function TensionTable({
  sources,
  tension,
  title = "Where sources diverge",
}: {
  sources: SourceVM[]
  tension: KeyTension | null
  title?: string
}) {
  const edge = tension?.edge ?? null
  const meta = tension?.meta ?? null

  // Backend points, if present; otherwise derive from source signals.
  const points =
    tension?.points && tension.points.length > 0
      ? tension.points.map((p, i) => ({
          num: p.num || String(i + 1).padStart(2, "0"),
          // LLM-authored labels arrive as "chatgpt", "Chatgpt:", etc.
          from: platformLabel(p.label),
          stance: p.text,
        }))
      : sources
          .filter((s) => !!s.signal)
          .map((s, i) => ({
            num: String(i + 1).padStart(2, "0"),
            from: s.label,
            stance: s.signal as string,
          }))

  if (points.length === 0 && !edge) return null

  return (
    <div className="rounded-panel border border-[rgba(217,119,87,0.2)] bg-[rgba(217,119,87,0.04)] px-[22px] py-5 dark:border-[rgba(217,119,87,0.28)] dark:bg-[rgba(217,119,87,0.08)]">
      <div className="mb-3.5 font-sans text-[10.5px] uppercase tracking-[0.08em] text-accent">
        Conflicting take · {title}
      </div>

      {points.length > 0 && (
        <div className="flex flex-col">
          {points.map((r, i) => (
            <div
              key={i}
              className="grid items-center gap-3.5 border-b border-border py-2 last:border-b-0"
              style={{ gridTemplateColumns: "24px 96px 1fr" }}
            >
              <div className="font-sans text-[10px] text-fg-subtle">{r.num}</div>
              <div className="font-serif text-[13px] font-semibold text-fg">{r.from}</div>
              <div className="font-serif text-[13px] leading-[1.5] text-fg-muted">
                {r.stance}
              </div>
            </div>
          ))}
        </div>
      )}

      {edge && (
        <div
          className={[
            "mt-3.5 flex items-center gap-3 font-serif text-[13px] leading-[1.5] text-fg",
            points.length > 0 ? "border-t border-border pt-3.5" : "",
            "before:font-bold before:text-accent before:content-['→']",
          ].join(" ")}
        >
          <strong className="font-semibold">Your edge.</strong>
          <span>{edge}</span>
        </div>
      )}

      {meta && (
        <div className="mt-2.5 font-sans text-[11.5px] leading-[1.5] text-fg-subtle">
          {meta}
        </div>
      )}
    </div>
  )
}
