"use client"

import { useMemo, useState } from "react"
import { Icon } from "@/components/misir/primitives/Icon"
import { SectionHead } from "@/components/misir/primitives/Card"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { usePeriodParams } from "@/lib/hooks/usePeriodParams"
import { getSpaceColor } from "@/lib/constants/space-colors"
import type {
  DashboardSource,
  PlatformType,
  Space,
} from "@/lib/api/types"
import { TensionTable } from "./TensionTable"
import { SourceCard, type SourceKey } from "./SourceCard"
import { SynthesisGrid } from "./SynthesisGrid"

type Scope = "all" | number

const SOURCE_COLORS: Record<SourceKey, string> = {
  claude: "#D97757",
  gemini: "#2A4A7A",
  web: "#2A6A4A",
}

const AI_PLATFORMS: PlatformType[] = [
  "claude",
  "chatgpt",
  "perplexity",
  "deepseek",
  "grok",
  "copilot",
  "notebooklm",
  "kimi",
]

function bucket(platform: string): SourceKey {
  const p = platform.toLowerCase()
  if (p === "gemini") return "gemini"
  if ((AI_PLATFORMS as string[]).includes(p)) return "claude"
  return "web"
}

export type SourceVM = {
  key: SourceKey
  label: string
  count: number
  /** Largest single-platform summary inside this bucket. */
  summary?: string
  findings: { text: string; conf: number }[]
  signal?: string
  /** Platforms contributing to this bucket (used in label). */
  platforms: string[]
}

function aggregateSources(sources: DashboardSource[]): SourceVM[] {
  const map = new Map<SourceKey, SourceVM>()
  for (const s of sources) {
    const key = bucket(s.key)
    const existing = map.get(key) ?? {
      key,
      label: keyLabel(key),
      count: 0,
      summary: undefined,
      findings: [],
      signal: undefined,
      platforms: [],
    }
    existing.count += s.artifacts
    if (s.topInsight && (!existing.summary || s.artifacts > existing.count / 2)) {
      existing.summary = s.topInsight
    }
    if (s.themes && s.themes.length > 0) {
      existing.findings.push(...s.themes)
    }
    if (s.signal && !existing.signal) existing.signal = s.signal
    if (!existing.platforms.includes(s.key)) {
      existing.platforms.push(s.key)
    }
    map.set(key, existing)
  }
  // Stable order: Claude, Gemini, Web.
  return (["claude", "gemini", "web"] as const)
    .map((k) => map.get(k))
    .filter((v): v is SourceVM => !!v && v.count > 0)
}

function keyLabel(k: SourceKey): string {
  return { claude: "Claude", gemini: "Gemini", web: "Web" }[k]
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
    () => aggregateSources(payload?.sources ?? []),
    [payload?.sources],
  )
  const totalCaptures = sources.reduce((s, r) => s + r.count, 0)

  return (
    <>
      <SectionHead
        title="Comparison"
        small="How your sources agree, conflict, and go silent"
        right={
          <span className="font-sans text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
            {totalCaptures} captures · {sources.length} source
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
          edge={payload.key_tension?.edge ?? null}
        />
      )}

      {sources.length > 0 ? (
        <div
          className="grid gap-3.5 mobile:grid-cols-1"
          style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          {sources.map((s) => (
            <SourceCard
              key={s.key}
              source={s}
              color={SOURCE_COLORS[s.key]}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-bg p-8 text-center text-[13px] text-fg-subtle">
          {dashboard.isLoading
            ? "Loading comparison…"
            : "Not enough captures yet to compare sources."}
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
