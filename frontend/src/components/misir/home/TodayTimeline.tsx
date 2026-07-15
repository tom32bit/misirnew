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
  const router = useRouter()

  if (captures.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-[13px] text-fg-subtle">
        Nothing captured recently.
      </div>
    )
  }

  const sortedRows = captures
    .slice()
    .sort((a, b) => (parseHM(a.time) ?? 0) - (parseHM(b.time) ?? 0))

  return (
    <div className="relative">
      {/* Vertical rail connecting the dots */}
      <div className="pointer-events-none absolute bottom-5 left-[82px] top-5 w-px bg-border" />

      {sortedRows.map((c) => {
        const subspace = subspaces.find((s) => s.id === c.subspaceId) ?? null
        const color = subspace ? getSubspaceColor(subspace) : "var(--accent)"

        return (
          // The row is a mouse convenience only — the real, keyboard-reachable
          // controls are the title button and the subspace button inside it
          // (a row-level role="button" would illegally nest interactives).
          <div
            key={c.id}
            onClick={() => router.push(`/dashboard/${spaceId}/collection`)}
            className="group flex cursor-pointer items-start gap-4 border-b border-border px-[18px] py-3.5 transition-colors last:border-b-0 hover:bg-bg-muted"
          >
            {/* Timestamp */}
            <span className="w-[44px] flex-none pt-[2px] text-right font-mono text-[10.5px] tabular-nums text-fg-subtle">
              {c.time}
            </span>

            {/* Dot — sits on the rail */}
            <span
              className="relative z-10 mt-[5px] block h-[7px] w-[7px] flex-none rounded-full ring-2 ring-bg"
              style={{ background: color }}
            />

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/dashboard/${spaceId}/collection`)
                  }}
                  className="min-w-0 flex-1 truncate rounded-sm text-left text-[13px] font-medium leading-[1.4] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                >
                  {c.title}
                </button>
                {c.revisit && (
                  <span className="flex-none rounded bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-accent">
                    ×{c.revisit}
                  </span>
                )}
              </div>

              <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden">
                <Icon
                  name={c.surfaceIcon}
                  size={11}
                  className="flex-none text-fg-subtle"
                />
                <span className="whitespace-nowrap font-mono text-[10.5px] text-fg-subtle">
                  {c.surface.replace(/^www\./, "")}
                </span>
                <span className="whitespace-nowrap rounded bg-bg-muted px-1.5 py-px font-mono text-[9.5px] text-fg-subtle">
                  {c.type}
                </span>
                {subspace && (
                  <>
                    <span className="flex-none text-fg-faint">·</span>
                    <span
                      className="h-[5px] w-[5px] flex-none rounded-full"
                      style={{ background: color }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(
                          `/dashboard/${spaceId}/collection?sub=${subspace.id}`,
                        )
                      }}
                      className="truncate font-mono text-[10.5px] text-fg-muted hover:text-fg"
                    >
                      {subspace.name}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
