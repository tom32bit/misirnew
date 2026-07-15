"use client"

import { Card, ProgressBar } from "@/components/misir/primitives/Card"
import { CountUp } from "@/components/misir/primitives/CountUp"
import type { SourceVM } from "./ComparisonView"

export function SourceCard({
  source,
  color,
}: {
  source: SourceVM
  color: string
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div
        className="flex flex-col gap-2 border-b border-border bg-bg-subtle px-[18px] py-3.5 dark:bg-bg-muted"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <div className="flex items-center justify-between">
          <span className="font-serif text-[14px] font-semibold text-fg">
            {source.label}
          </span>
          <span className="rounded-full border border-border bg-bg-muted px-2 py-0.5 font-sans text-[10px] font-semibold tabular-nums text-fg">
            <CountUp value={source.count} /> artifact{source.count === 1 ? "" : "s"}
          </span>
        </div>
        {source.summary && (
          <p className="font-serif text-[12.5px] leading-[1.5] text-fg opacity-90">
            {source.summary}
          </p>
        )}
      </div>

      <div className="px-[18px] py-3.5">
        {source.findings.length === 0 ? (
          <div className="text-[12px] text-fg-subtle">No findings yet.</div>
        ) : (
          <>
            <div className="mb-1.5 font-sans text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
              Key findings
            </div>
            {source.findings.slice(0, 5).map((f, i) => (
              <div
                key={i}
                className="grid items-center gap-3 border-b border-border py-2 last:border-b-0"
                style={{ gridTemplateColumns: "44px 1fr" }}
              >
                <div>
                  <div className="font-sans text-[11px] font-semibold tabular-nums text-fg">
                    <CountUp value={f.conf} suffix="%" />
                  </div>
                  {/* Confidence bar carries the source's own colour, like the card. */}
                  <ProgressBar value={f.conf} color={color} className="mt-0.5" />
                </div>
                <div className="font-serif text-[12.5px] leading-[1.45] text-fg-muted">
                  {f.text}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {source.signal && (
        <div
          className="mx-4 mb-4 rounded-md bg-bg-subtle px-3.5 py-3 dark:bg-bg-inset"
          style={{ borderLeft: `3px solid var(--accent)` }}
        >
          <div className="mb-1 font-sans text-[10.5px] uppercase tracking-[0.08em] text-fg">
            Unique signal
          </div>
          <div className="font-serif text-[12px] leading-[1.5] text-fg-muted">
            {source.signal}
          </div>
        </div>
      )}
    </Card>
  )
}
