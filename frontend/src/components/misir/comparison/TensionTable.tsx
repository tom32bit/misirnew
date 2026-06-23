"use client"

import type { SourceVM } from "./ComparisonView"

/**
 * Orange-tinted "Conflicting take" card. The prototype hardcoded a tension
 * per space; in production we synthesise it client-side from each source's
 * `signal` text (one row per source) and use the synthesis `top_insight`
 * as the edge line.
 */
export function TensionTable({
  sources,
  edge,
  title = "Where sources diverge",
}: {
  sources: SourceVM[]
  edge: string | null
  title?: string
}) {
  const rows = sources
    .map((s) => ({ from: s.label, stance: s.signal }))
    .filter((r): r is { from: string; stance: string } => !!r.stance)

  if (rows.length === 0 && !edge) return null

  return (
    <div className="rounded-lg border border-[rgba(255,108,60,0.2)] bg-[rgba(255,108,60,0.04)] px-[22px] py-5 dark:border-[rgba(255,108,60,0.28)] dark:bg-[rgba(255,108,60,0.08)]">
      <div className="mb-3.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-accent">
        Conflicting take · {title}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid items-center gap-3.5 border-b border-border py-2 last:border-b-0"
              style={{ gridTemplateColumns: "24px 96px 1fr" }}
            >
              <div className="font-mono text-[10px] text-fg-subtle">
                {String(i + 1).padStart(2, "0")}
              </div>
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
            rows.length > 0 ? "border-t border-border pt-3.5" : "",
            "before:font-bold before:text-accent before:content-['→']",
          ].join(" ")}
        >
          <strong className="font-semibold">Your edge.</strong>
          <span>{edge}</span>
        </div>
      )}
    </div>
  )
}
