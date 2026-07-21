"use client"

import { useMemo, useState } from "react"
import { SectionHead } from "@/components/misir/primitives/Card"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { usePeriodParams } from "@/lib/hooks/usePeriodParams"
import { getSpaceColor } from "@/lib/constants/space-colors"
import { platformLabel } from "@/lib/constants/surface-icons"
import { Skeleton } from "@/components/misir/primitives/Skeleton"
import { CountUp } from "@/components/misir/primitives/CountUp"
import type {
  DashboardSource,
  Space,
} from "@/lib/api/types"
import { TensionTable } from "./TensionTable"
import { SourceCard } from "./SourceCard"
import { SynthesisGrid } from "./SynthesisGrid"

type Scope = "all" | number

// Fallback colour if the backend ever emits a source without one.
const FALLBACK_SOURCE_COLOR = "#8A8A82"

export type SourceVM = {
  /** The real platform/source key from the backend (chatgpt, perplexity, web…). */
  key: string
  label: string
  count: number
  color: string
  summary?: string
  findings: { text: string; conf: number }[]
  signal?: string
}

// One card per real source the backend reports — no bucketing, so a ChatGPT or
// Perplexity capture is labelled and coloured as itself, not folded into
// "Claude". Merge defensively by key in case the backend ever repeats one.
function toSourceVMs(sources: DashboardSource[]): SourceVM[] {
  const map = new Map<string, SourceVM>()
  for (const s of sources) {
    const existing = map.get(s.key)
    if (existing) {
      existing.count += s.artifacts
      if (s.topInsight && !existing.summary) existing.summary = s.topInsight
      if (s.themes?.length) existing.findings.push(...s.themes)
      if (s.signal && !existing.signal) existing.signal = s.signal
    } else {
      map.set(s.key, {
        key: s.key,
        // Normalize through the canonical map — backend labels vary between
        // raw keys and str.capitalize() ("Chatgpt") depending on cache age.
        label: platformLabel(s.key),
        count: s.artifacts,
        color: s.color || FALLBACK_SOURCE_COLOR,
        summary: s.topInsight || undefined,
        findings: s.themes ? [...s.themes] : [],
        signal: s.signal || undefined,
      })
    }
  }
  return Array.from(map.values())
    .filter((v) => v.count > 0)
    .sort((a, b) => b.count - a.count)
}

export function ComparisonView({ scope }: { scope: Scope }) {
  const isAll = scope === "all"
  const { period, date, tzOffset } = usePeriodParams()

  const { data: spaces = [] } = useSpaces()
  const [activeSpaceId, setActiveSpaceId] = useState<number | null>(
    isAll ? spaces[0]?.id ?? null : (scope as number),
  )

  // When the spaces list arrives, lock activeSpaceId to the first space (all-mode).
  const effectiveSpaceId = isAll
    ? activeSpaceId ?? spaces[0]?.id ?? null
    : (scope as number)

  const dashboard = useDashboard(effectiveSpaceId, period, tzOffset, date)
  const payload = dashboard.data
  const sources = useMemo(
    () => toSourceVMs(payload?.sources ?? []),
    [payload?.sources],
  )
  const totalCaptures = sources.reduce((s, r) => s + r.count, 0)

  return (
    <>
      <SectionHead
        icon="columns-3"
        title="Comparison"
        small="How your sources agree, conflict, and go silent"
        right={
          <span className="font-sans text-[10.5px] uppercase tracking-[0.08em] tabular-nums text-fg-muted">
            <CountUp value={totalCaptures} /> captures · <CountUp value={sources.length} /> source
            {sources.length === 1 ? "" : "s"}
          </span>
        }
      />

      {isAll && spaces.length > 0 && (
        <SpaceTabRow
          spaces={spaces}
          activeId={effectiveSpaceId}
          onSelect={setActiveSpaceId}
        />
      )}

      {payload && (
        <TensionTable
          sources={sources}
          tension={payload.key_tension}
        />
      )}

      {sources.length > 0 ? (
        <div
          className="grid gap-3.5 grid-cols-[repeat(var(--src-cols),minmax(0,1fr))] mobile:grid-cols-1"
          style={{ ["--src-cols" as string]: String(Math.min(3, sources.length)) }}
        >
          {sources.map((s) => (
            <SourceCard key={s.key} source={s} color={s.color} />
          ))}
        </div>
      ) : dashboard.isLoading ? (
        // Source-card-shaped skeletons — same grid the real cards land in.
        <div className="grid grid-cols-3 gap-3.5 mobile:grid-cols-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-panel border border-border bg-bg p-[18px]">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-14" />
              </div>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <div className="mt-2 flex flex-col gap-2.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-11/12" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-panel border border-border bg-bg p-8 text-center text-[13px] text-fg-subtle">
          Not enough captures yet to compare sources.
        </div>
      )}

      {payload?.synthesis && (
        <SynthesisGrid
          synthesis={payload.synthesis}
          readiness={undefined}
          onFillGapsHref={
            effectiveSpaceId
              ? `/dashboard/${effectiveSpaceId}/decision`
              : "/dashboard/all/decision"
          }
        />
      )}

    </>
  )
}

function SpaceTabRow({
  spaces,
  activeId,
  onSelect,
}: {
  spaces: Space[]
  activeId: number | null
  onSelect: (id: number) => void
}) {
  return (
    <div className="-mb-1 flex flex-wrap gap-1">
      {spaces.map((s) => {
        const color = getSpaceColor(s)
        const active = s.id === activeId
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={[
              "inline-flex h-8 items-center gap-1.5 rounded-md border bg-bg px-3.5 text-[12.5px] transition-colors",
              "before:block before:h-[7px] before:w-[7px] before:rounded-full",
              active
                ? "font-medium"
                : "text-fg-muted hover:bg-bg-muted hover:text-fg",
            ].join(" ")}
            style={
              active
                ? {
                    background: `color-mix(in srgb, ${color} 10%, var(--bg))`,
                    borderColor: `color-mix(in srgb, ${color} 50%, transparent)`,
                    color,
                    ["--sc" as string]: color,
                  }
                : {
                    borderColor: "var(--border-strong)",
                    ["--sc" as string]: color,
                  }
            }
          >
            <span
              className="block h-[7px] w-[7px] rounded-full"
              style={{ background: color }}
            />
            {s.name}
          </button>
        )
      })}
    </div>
  )
}
