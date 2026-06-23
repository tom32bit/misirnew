"use client"

import { Icon } from "@/components/misir/primitives/Icon"
import { stripInlineMarkdown } from "@/lib/utils"
import type { Deadline, MisirsRead, Space } from "@/lib/api/types"

function relUpdated(iso: string | null | undefined): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  const diff = Date.now() - t
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return "just now"
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return "Yesterday"
  return `${d}d ago`
}

function daysUntil(iso: string): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.round((t - Date.now()) / (24 * 3_600_000)))
}

export function MisirBrief({
  space,
  deadline,
  readiness,
  color,
  capturesWeek,
  subspaceCount,
  misirRead,
  criticalGaps,
  onChat,
}: {
  space: Space | undefined
  deadline: Deadline | null | undefined
  readiness: number
  color: string
  capturesWeek: number
  subspaceCount: number
  misirRead?: MisirsRead | null
  criticalGaps?: number
  onChat?: () => void
}) {
  const updated = relUpdated(space?.updated_at)
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
      <div className="mb-3.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
        <Icon name="zap" size={11} />
        Misir&apos;s read · {space?.name ?? "—"}
        {updated ? <span> · {updated}</span> : null}
      </div>

      <p className="mb-4 max-w-[820px] font-display text-[24px] font-medium leading-[1.4] tracking-[-0.02em] text-fg [text-wrap:pretty]">
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

      {deadline && (
        <div className="inline-flex items-center gap-2.5 rounded-md bg-bg-subtle px-3 py-1.5">
          <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color }}>
            <Icon name="clock" size={11} />
            <span className="font-medium">{deadline.label}</span>
            <span className="font-semibold">
              · {daysUntil(deadline.due_at)}d
            </span>
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="font-mono text-[11px] tracking-[0.04em] text-fg-muted">
            {readiness}% readiness
          </span>
        </div>
      )}

      {((criticalGaps !== undefined && criticalGaps > 0) || !!onChat) && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {criticalGaps !== undefined && criticalGaps > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgba(255,108,60,0.06)] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">
              <Icon name="alert-circle" size={11} />
              {criticalGaps} critical gap{criticalGaps === 1 ? "" : "s"}
            </span>
          )}
          {onChat && (
            <button
              type="button"
              onClick={onChat}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3.5 py-1.5 text-[12.5px] text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
            >
              Chat with Misir
              <Icon name="arrow-right" size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
