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
}: {
  space: Space | undefined
  deadline: Deadline | null | undefined
  readiness: number
  color: string
  capturesWeek: number
  subspaceCount: number
  misirRead?: MisirsRead | null
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

      <p className="mb-3.5 max-w-[820px] font-display text-[20px] font-medium leading-[1.5] tracking-[-0.015em] text-fg [text-wrap:pretty]">
        {headline}
      </p>

      {misirRead && misirRead.points.length > 0 && (
        <ul className="mb-3.5 flex list-none flex-col gap-2 p-0">
          {misirRead.points.map((pt, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-[1.6]">
              <span
                className="mt-[3px] h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: pt.accent ? "var(--accent)" : "var(--fg-faint)" }}
              />
              <span>
                <strong className="font-semibold text-fg">{stripInlineMarkdown(pt.label)}</strong>
                {pt.body ? <span className="text-fg-muted"> — {stripInlineMarkdown(pt.body)}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {deadline && (
        <div
          className="flex items-center gap-1.5 text-[13px]"
          style={{ color }}
        >
          <Icon name="clock" size={12} />
          <span>{deadline.label}</span>
          <span>·</span>
          <strong className="font-semibold">
            {daysUntil(deadline.due_at)} day{daysUntil(deadline.due_at) === 1 ? "" : "s"}
          </strong>
          <span className="ml-4 font-mono text-[11px] tracking-wide text-fg-muted">
            {readiness}% readiness
          </span>
        </div>
      )}
    </div>
  )
}
