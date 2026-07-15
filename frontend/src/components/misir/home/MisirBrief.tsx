"use client"

import { Icon } from "@/components/misir/primitives/Icon"
import { Button } from "@/components/misir/primitives/Button"
import { ProgressBar } from "@/components/misir/primitives/Card"
import { CountUp } from "@/components/misir/primitives/CountUp"
import { stripInlineMarkdown } from "@/lib/utils"
import type { Deadline, MisirsRead, Space } from "@/lib/api/types"

function daysUntil(iso: string): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.round((t - Date.now()) / (24 * 3_600_000)))
}

export function MisirBrief({
  deadline,
  readiness,
  color,
  capturesWeek,
  subspaceCount,
  misirRead,
  onChat,
}: {
  space?: Space | undefined
  deadline: Deadline | null | undefined
  readiness: number
  color: string
  capturesWeek: number
  subspaceCount: number
  misirRead?: MisirsRead | null
  criticalGaps?: number
  onChat?: () => void
}) {
  // Real headline from the backend, or a neutral line computed from real counts
  // (never editorial demo copy) when Misir hasn't written a read yet.
  const fallbackHeadline =
    capturesWeek > 0
      ? `${capturesWeek} capture${capturesWeek === 1 ? "" : "s"} this week across ${subspaceCount} subspace${subspaceCount === 1 ? "" : "s"}.`
      : "Capture sources for this space and Misir will start reading."
  const headline = misirRead?.headline
    ? stripInlineMarkdown(misirRead.headline)
    : fallbackHeadline

  return (
    <div className="pt-2 pb-6">
      <p className="mb-5 font-display text-[26px] font-medium leading-[1.15] tracking-[-0.02em] text-fg [text-wrap:pretty]">
        {headline}
      </p>

      {misirRead && misirRead.points.length > 0 && (
        <div className="mb-4 flex max-w-[760px] flex-col gap-3">
          {misirRead.points.map((pt, i) => (
            <p
              key={i}
              className={[
                "m-0 font-serif text-[14px] leading-[1.7] [text-wrap:pretty]",
                pt.accent ? "text-fg" : "text-fg-muted",
              ].join(" ")}
            >
              <strong className="font-sans font-semibold text-fg">
                {stripInlineMarkdown(pt.label)}.{" "}
              </strong>
              {pt.body ? stripInlineMarkdown(pt.body) : null}
            </p>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.11em] text-fg-subtle">
            Readiness
          </span>
          <ProgressBar value={readiness} color={color} className="h-1 w-[148px] rounded-full" />
          <span className="text-[13px] tabular-nums text-fg-muted">
            <CountUp value={readiness} suffix="%" />
          </span>
        </div>
        {deadline && (
          <div className="flex items-center gap-3">
            <span className="h-[3px] w-[3px] rounded-full bg-fg-faint" />
            <span className="text-[13px] text-fg-subtle">
              <span className="font-medium text-fg-muted">
                {daysUntil(deadline.due_at)} days
              </span>{" "}
              to {deadline.label}
            </span>
          </div>
        )}
      </div>

      {onChat && (
        <Button variant="primary" onClick={onChat}>
          Chat with Misir
          <Icon name="arrow-right" size={12} />
        </Button>
      )}
    </div>
  )
}
