"use client"

import { useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/misir/primitives/Icon"
import { SectionHead } from "@/components/misir/primitives/Card"
import { ChatCTA } from "@/components/misir/primitives/ChatCTA"
import { ReadinessRing } from "@/components/misir/primitives/ReadinessRing"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { useDashboard, useDashboards } from "@/lib/hooks/useDashboard"
import { useGaps } from "@/lib/hooks/useGaps"
import { useDeadline } from "@/lib/hooks/useDeadline"
import { usePeriodParams } from "@/lib/hooks/usePeriodParams"
import {
  countCriticalGaps,
  deriveReadiness,
} from "@/lib/api/adapters"
import { getSpaceColor } from "@/lib/constants/space-colors"
import { useUIStore } from "@/lib/stores/ui-store"
import type { Space } from "@/lib/api/types"
import { DecisionHero } from "./DecisionHero"
import { ProConGrid } from "./ProConGrid"
import { KnowledgeGaps } from "./KnowledgeGaps"

type Scope = "all" | number

export function DecisionView({ scope }: { scope: Scope }) {
  if (scope === "all") return <DecisionAll />
  return <DecisionBody spaceId={scope} />
}

function DecisionAll() {
  const { period, date, tzOffset } = usePeriodParams()
  const { data: spaces = [] } = useSpaces()
  const dashboards = useDashboards(
    spaces.map((s) => s.id),
    period,
    tzOffset,
    date,
  )
  const [activeId, setActiveId] = useState<number | null>(spaces[0]?.id ?? null)
  const effectiveId = activeId ?? spaces[0]?.id ?? null

  return (
    <>
      <SectionHead
        title="Decision tree"
        small="Readiness across all spaces"
      />
      <div
        className="grid gap-3.5 mobile:grid-cols-1"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {spaces.map((s, i) => {
          const dash = dashboards[i]?.data
          const readiness = deriveReadiness(dash)
          const critGaps = countCriticalGaps(dash)
          const totalGaps = dash?.gaps?.length ?? 0
          return (
            <SpaceDecisionCard
              key={s.id}
              space={s}
              readiness={readiness}
              criticalGaps={critGaps}
              totalGaps={totalGaps}
              onSelect={() => setActiveId(s.id)}
            />
          )
        })}
      </div>

      {effectiveId != null && (
        <>
          <SectionHead
            title="Detailed view"
            small={spaces.find((x) => x.id === effectiveId)?.name ?? ""}
            right={
              <div className="flex flex-wrap gap-1.5">
                {spaces.map((s) => {
                  const color = getSpaceColor(s)
                  const active = s.id === effectiveId
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveId(s.id)}
                      className={[
                        "inline-flex h-[26px] items-center gap-1.5 rounded-[5px] border bg-bg px-2.5 text-[11.5px] transition-colors",
                        "before:block before:h-[5px] before:w-[5px] before:rounded-full",
                        active ? "font-medium" : "text-fg-muted hover:bg-bg-muted hover:text-fg",
                      ].join(" ")}
                      style={
                        active
                          ? {
                              background: `color-mix(in srgb, ${color} 10%, var(--bg))`,
                              borderColor: `color-mix(in srgb, ${color} 50%, transparent)`,
                              color,
                            }
                          : { borderColor: "var(--border)" }
                      }
                    >
                      <span
                        className="block h-[5px] w-[5px] rounded-full"
                        style={{ background: color }}
                      />
                      {s.name.split(" ").slice(0, 2).join(" ")}
                    </button>
                  )
                })}
              </div>
            }
          />
          <DecisionBody spaceId={effectiveId} />
        </>
      )}
    </>
  )
}

function SpaceDecisionCard({
  space,
  readiness,
  criticalGaps,
  totalGaps,
  onSelect,
}: {
  space: Space
  readiness: number
  criticalGaps: number
  totalGaps: number
  onSelect: () => void
}) {
  const color = getSpaceColor(space)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-bg p-4 transition-shadow hover:shadow-sm"
      style={{ borderTop: `4px solid ${color}` }}
    >
      <div>
        <div className="font-serif text-[16px] font-semibold text-fg">
          {space.name}
        </div>
      </div>
      <div
        className="grid items-center gap-3.5"
        style={{ gridTemplateColumns: "auto 1fr" }}
      >
        <div className="flex flex-col items-center gap-1">
          <ReadinessRing
            value={readiness}
            size={56}
            thickness={6}
            color={color}
            showPercent
            fontSize={14}
          />
          <div className="font-sans text-[10px] tracking-wide text-fg-subtle">
            readiness
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[12.5px] text-fg-muted">
            <Icon name="git-branch" size={11} />
            <strong className="font-semibold text-fg">{totalGaps}</strong> gap
            {totalGaps === 1 ? "" : "s"}
          </div>
          {criticalGaps > 0 ? (
            <div className="flex items-center gap-1.5 text-[12.5px] text-accent">
              <strong className="font-semibold">{criticalGaps}</strong> critical
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[12.5px] text-success">
              <Icon name="check-circle" size={11} />
              No critical
            </div>
          )}
        </div>
      </div>
      <div className="pt-1">
        <Link
          href={`/dashboard/${space.id}/decision`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-bg-muted"
          style={{
            color,
            borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          Full tree
          <Icon name="arrow-right" size={11} />
        </Link>
      </div>
    </div>
  )
}

function DecisionBody({ spaceId }: { spaceId: number }) {
  const { period, date, tzOffset } = usePeriodParams()
  const dashboard = useDashboard(spaceId, period, tzOffset, date)
  const gaps = useGaps(spaceId)
  const deadline = useDeadline(spaceId)
  const openModal = useUIStore((s) => s.openModal)

  const readiness = deriveReadiness(dashboard.data)
  const backendDec = dashboard.data?.decision

  // No editorial fallback. When Misir hasn't built a decision yet (new space,
  // too few captures, or the LLM hasn't run), show an honest empty state rather
  // than fabricated demo content.
  if (!backendDec) {
    return (
      <>
        <DecisionEmpty loading={dashboard.isLoading} readiness={readiness} />
        <KnowledgeGaps spaceId={spaceId} gaps={gaps.data ?? []} />
      </>
    )
  }

  // Everything below is derived from real backend output only. The few `??`
  // here fall back to values derived from the decision itself (never demo text).
  const question =
    backendDec.question ?? `${backendDec.option_a.label} or ${backendDec.option_b.label}?`
  const optionA = { label: backendDec.option_a.label, note: backendDec.option_a.note ?? "" }
  const optionB = { label: backendDec.option_b.label, note: backendDec.option_b.note ?? "" }
  const ask = backendDec.ask ?? "Want to talk through this decision?"

  return (
    <>
      <DecisionHero
        question={question}
        optionA={{ ...optionA, readiness }}
        optionB={{ ...optionB, readiness: 0 }}
        readiness={readiness}
        deadline={deadline.data ?? null}
      />
      <ProConGrid pros={backendDec.option_a.pros} cons={backendDec.option_a.cons} />
      <KnowledgeGaps spaceId={spaceId} gaps={gaps.data ?? []} />
      <ChatCTA
        title={ask}
        hint="Misir uses your captures + subspace context to answer."
        ctaLabel={
          <>
            Start chat
            <Icon name="arrow-right" size={12} />
          </>
        }
        onClick={() =>
          openModal({ kind: "new-chat", defaultSpaceId: spaceId })
        }
      />
    </>
  )
}

function DecisionEmpty({
  loading,
  readiness,
}: {
  loading: boolean
  readiness: number
}) {
  return (
    <div className="rounded-[10px] border border-border bg-bg-muted/40 px-[22px] py-9 text-center">
      <div className="mb-2 font-sans text-[10.5px] uppercase tracking-[0.08em] text-fg-subtle">
        Active strategic decision
      </div>
      <div className="mx-auto max-w-md font-display text-[17px] font-semibold leading-[1.35] tracking-tight text-fg">
        {loading
          ? "Analyzing your captures…"
          : "Not enough signal yet to frame a decision"}
      </div>
      <p className="mx-auto mt-2 max-w-md font-serif text-[13px] leading-[1.55] text-fg-muted">
        {loading
          ? "Misir is reading what you've captured for this space."
          : "Capture a few more sources for this space and Misir will frame the key decision, the options, and the trade-offs — drawn from your own research."}
      </p>
      {!loading && (
        <div className="mt-3 font-sans text-[11.5px] text-fg-subtle">
          Source coverage {readiness}%
        </div>
      )}
    </div>
  )
}
