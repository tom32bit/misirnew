"use client"

import { useRouter } from "next/navigation"
import { Icon } from "@/components/misir/primitives/Icon"
import { getSubspaceColor } from "@/lib/constants/subspace-colors"
import type { Subspace } from "@/lib/api/types"
import type { CaptureVM } from "@/lib/api/capture-adapters"

function parseHM(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60
}

export function TodayTimeline({
  spaceId,
  captures,
  subspaces,
}: {
  spaceId: number
  captures: CaptureVM[]
  subspaces: Subspace[]
}) {
  if (captures.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-[13px] text-fg-subtle">
        No captures yet today.
      </div>
    )
  }

  const times = captures
    .map((c) => parseHM(c.time))
    .filter((v): v is number => v !== null)
  const minH = Math.max(0, Math.floor(Math.min(...times)))
  const maxH = Math.min(23, Math.ceil(Math.max(...times)))
  const span = Math.max(1, maxH - minH)
  const hours: number[] = []
  for (let h = minH; h <= maxH; h++) hours.push(h)

  const sortedRows = captures
    .slice()
    .sort((a, b) => (parseHM(a.time) ?? 0) - (parseHM(b.time) ?? 0))

  return (
    <>
      {/* Day arc */}
      <div className="border-b border-border bg-bg-subtle px-6 pb-2 pt-3.5">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-fg-muted">
          Day arc · {String(minH).padStart(2, "0")}:00 →{" "}
          {String(maxH).padStart(2, "0")}:00
        </div>
        <div className="relative mt-3.5 h-7 border-t border-border-strong">
          {hours.map((h) => (
            <span
              key={h}
              className="absolute -top-4 -translate-x-1/2 font-mono text-[9.5px] tracking-[0.08em] text-fg-subtle"
              style={{ left: `${((h - minH) / span) * 100}%` }}
            >
              {String(h).padStart(2, "0")}
              <span className="absolute left-1/2 top-[14px] h-1 w-px bg-border-strong" />
            </span>
          ))}
          {captures.map((c) => {
            const t = parseHM(c.time)
            if (t == null) return null
            const subspace = subspaces.find((s) => s.id === c.subspaceId)
            const color = subspace ? getSubspaceColor(subspace) : "var(--accent)"
            const revisit = !!c.revisit
            return (
              <span
                key={c.id}
                title={`${c.time} · ${c.title}`}
                className={[
                  "absolute -translate-x-1/2 cursor-pointer rounded-full transition-transform hover:scale-[1.4]",
                  revisit ? "border-2" : "",
                ].join(" ")}
                style={{
                  left: `${((t - minH) / span) * 100}%`,
                  top: revisit ? 3 : 4,
                  width: revisit ? 10 : 8,
                  height: revisit ? 10 : 8,
                  background: revisit ? "var(--bg-subtle)" : color,
                  borderColor: revisit ? color : "transparent",
                  boxShadow: "0 0 0 2px var(--bg-subtle)",
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Rows */}
      <div className="py-1.5">
        {sortedRows.map((c) => {
          const subspace = subspaces.find((s) => s.id === c.subspaceId) ?? null
          const color = subspace ? getSubspaceColor(subspace) : "var(--accent)"
          return (
            <TimelineRow
              key={c.id}
              spaceId={spaceId}
              capture={c}
              subspace={subspace}
              color={color}
            />
          )
        })}
      </div>
    </>
  )
}

function TimelineRow({
  spaceId,
  capture,
  subspace,
  color,
}: {
  spaceId: number
  capture: CaptureVM
  subspace: Subspace | null
  color: string
}) {
  const router = useRouter()
  const isRevisit = !!capture.revisit

  return (
    <div
      className={[
        "group relative grid cursor-pointer items-start gap-3 py-3 pl-[18px] pr-[22px] transition-colors hover:bg-bg-muted mobile:gap-2",
        isRevisit
          ? "bg-[rgba(255,108,60,0.03)] hover:bg-[rgba(255,108,60,0.06)]"
          : "",
      ].join(" ")}
      style={{ gridTemplateColumns: "52px 5px 18px 1fr auto" }}
    >
      <div className="pt-0.5 font-mono text-[11px] tracking-[0.02em] text-fg-subtle">
        {capture.time}
      </div>
      <div
        className="self-stretch min-h-7 rounded-sm opacity-85"
        style={{ background: color, width: 5 }}
      />
      <div className="inline-flex h-[18px] w-[18px] items-center justify-center pt-px text-fg-muted mobile:hidden">
        <Icon name={capture.surfaceIcon} size={14} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <div className="min-w-0 flex-1 truncate text-[13.5px] leading-[1.4] tracking-[-0.005em] text-fg">
            {capture.title}
          </div>
          {isRevisit && (
            <span className="flex-none rounded-sm bg-[rgba(255,108,60,0.10)] px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-accent">
              revisited ×{capture.revisit}
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-fg-muted">
          <span className="font-mono lowercase tracking-[0.04em]">
            {capture.type.toLowerCase()}
          </span>
          <span className="text-fg-faint">·</span>
          <span className="font-mono text-fg-subtle">{capture.surface}</span>
          {subspace && (
            <>
              <span className="text-fg-faint">·</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(
                    `/dashboard/${spaceId}/collection?sub=${subspace.id}`,
                  )
                }}
                className="inline-flex items-center gap-1.5 bg-transparent p-0 text-[11.5px] text-fg-muted hover:text-fg"
              >
                <span
                  className="block h-[5px] w-[5px] rounded-full"
                  style={{ background: color }}
                />
                {subspace.name}
              </button>
            </>
          )}
        </div>
      </div>
      <span className="inline-flex items-center self-center gap-1 whitespace-nowrap rounded-sm border border-border bg-bg px-2 py-px pl-1.5 font-mono text-[10.5px] text-fg">
        <span className="block h-[4px] w-[4px] rounded-full bg-accent" />
        {capture.marker || "—"}
      </span>
    </div>
  )
}
