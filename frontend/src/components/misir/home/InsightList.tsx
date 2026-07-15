"use client"

import Link from "next/link"
import { Icon } from "@/components/misir/primitives/Icon"
import { SectionHead } from "@/components/misir/primitives/Card"
import type { ReportPeriod } from "@/lib/api/types"
import type { SpaceVM } from "./HomeAll"

type InsightType = "nudge" | "gap" | "cross_space" | "activity" | "synthesis"

type DynamicInsight = {
  type: InsightType
  chips: { id: number; name: string }[]
  text: string
  cta: string
  href: string
}

const TYPE_META: Record<InsightType, { label: string; icon: string; color: string; bg: string }> = {
  nudge:       { label: "Nudge",       icon: "zap",        color: "var(--color-accent)",      bg: "color-mix(in srgb, var(--color-accent) 3%, transparent)" },
  gap:         { label: "Gap",         icon: "git-branch", color: "var(--color-danger)",      bg: "color-mix(in srgb, var(--color-danger) 3%, transparent)" },
  cross_space: { label: "Cross-space", icon: "link-2",     color: "var(--color-accent-blue)", bg: "color-mix(in srgb, var(--color-accent-blue) 3%, transparent)" },
  activity:    { label: "Activity",    icon: "activity",   color: "var(--color-success)",     bg: "color-mix(in srgb, var(--color-success) 3%, transparent)" },
  synthesis:   { label: "Synthesis",   icon: "layers",     color: "var(--fg-subtle)",         bg: "color-mix(in srgb, var(--fg-subtle) 3%, transparent)" },
}

const SEV_RANK: Record<string, number> = { Critical: 3, High: 2, Medium: 1 }

function deriveInsights(vms: SpaceVM[], period: ReportPeriod): DynamicInsight[] {
  const insights: DynamicInsight[] = []

  // 1. Highest-priority nudge across all spaces
  const topNudge = vms
    .flatMap((vm) =>
      (vm.dashboard?.nudges ?? [])
        .filter((n) => n.status === "active")
        .map((n) => ({ n, vm })),
    )
    .sort((a, b) => b.n.priority - a.n.priority)[0]

  if (topNudge) {
    const { n, vm } = topNudge
    insights.push({
      type: "nudge",
      chips: [{ id: vm.space.id, name: vm.space.name }],
      text: [n.scatter, n.direction].filter(Boolean).join(" "),
      cta: n.cta_label ?? "Take action",
      href: `/dashboard/${vm.space.id}/notification`,
    })
  }

  // 2. Most critical open gap across all spaces
  const topGap = vms
    .flatMap((vm) =>
      (vm.dashboard?.gaps ?? [])
        .filter((g) => g.status === "open")
        .map((g) => ({ g, vm })),
    )
    .sort((a, b) => (SEV_RANK[b.g.severity] ?? 0) - (SEV_RANK[a.g.severity] ?? 0))[0]

  if (topGap) {
    const { g, vm } = topGap
    const body = g.action ? `${g.label} — ${g.action}` : g.label
    insights.push({
      type: "gap",
      chips: [{ id: vm.space.id, name: vm.space.name }],
      text: body,
      cta: "Address gap",
      href: `/dashboard/${vm.space.id}/notification`,
    })
  }

  // 3. First cross-space connection found
  const crossHit = vms
    .flatMap((vm) =>
      (vm.dashboard?.cross_space ?? []).map((c) => ({ c, vm })),
    )[0]

  if (crossHit) {
    const { c, vm } = crossHit
    insights.push({
      type: "cross_space",
      chips: [{ id: vm.space.id, name: vm.space.name }],
      text: `"${c.source_title}" connects to "${c.target_gap}" in another space.`,
      cta: "Connect spaces",
      href: `/dashboard/all/comparison`,
    })
  }

  // 4. Most active space this period
  if (insights.length < 4) {
    const active = vms
      .filter((vm) => vm.capturesWeek > 0)
      .sort((a, b) => b.capturesWeek - a.capturesWeek)[0]

    if (active) {
      const periodLabel = period === "today" ? "today" : period === "month" ? "this month" : "this week"
      insights.push({
        type: "activity",
        chips: [{ id: active.space.id, name: active.space.name }],
        text: `${active.capturesWeek} capture${active.capturesWeek === 1 ? "" : "s"} ${periodLabel}. Readiness is at ${active.readiness}%.`,
        cta: "See collection",
        href: `/dashboard/${active.space.id}/collection`,
      })
    }
  }

  // 5. Synthesis consensus (if available and there's room)
  if (insights.length < 5) {
    const synthHit = vms
      .filter((vm) => !!vm.dashboard?.synthesis?.consensus)
      .sort((a, b) => (b.dashboard?.synthesis?.readiness ?? 0) - (a.dashboard?.synthesis?.readiness ?? 0))[0]

    if (synthHit?.dashboard?.synthesis) {
      const s = synthHit.dashboard.synthesis
      insights.push({
        type: "synthesis",
        chips: [{ id: synthHit.space.id, name: synthHit.space.name }],
        text: s.consensus,
        cta: "View comparison",
        href: `/dashboard/${synthHit.space.id}/comparison`,
      })
    }
  }

  return insights
}

export function InsightList({
  vms,
  period,
}: {
  vms: SpaceVM[]
  period: ReportPeriod
}) {
  const loading = vms.some((v) => v.loading)
  const insights = deriveInsights(vms, period)

  if (loading || insights.length === 0) return null

  return (
    <>
      <SectionHead
        icon="sparkles"
        title="What Misir noticed"
        small={`${insights.length} thing${insights.length === 1 ? "" : "s"} worth knowing`}
      />

      <div className="overflow-hidden rounded-panel border border-border">
        {insights.map((ins) => {
          const meta = TYPE_META[ins.type]
          return (
            <Link
              key={`${ins.type}:${ins.href}`}
              href={ins.href}
              className="flex items-center gap-5 border-b border-border bg-bg px-5 py-4 transition-colors last:border-b-0 hover:bg-[var(--ins-bg)] mobile:flex-col mobile:items-start mobile:gap-2.5 mobile:px-3"
              style={{ ["--ins-bg" as string]: meta.bg } as React.CSSProperties}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: meta.color }}
                  >
                    <Icon name={meta.icon} size={12} />
                    {meta.label}
                  </span>
                  {ins.chips.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center rounded-sm border px-[7px] py-px text-[10.5px] font-medium"
                      style={{
                        color: meta.color,
                        borderColor: `color-mix(in srgb, ${meta.color} 30%, transparent)`,
                        background: `color-mix(in srgb, ${meta.color} 7%, transparent)`,
                      }}
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
                {ins.type === "synthesis" ? (
                  // The synthesis consensus is the most valuable thing here —
                  // give it editorial weight as an upright, quoted pull-quote.
                  <p className="m-0 font-serif text-[16px] leading-[1.5] text-fg [text-wrap:pretty]">
                    {"“"}{ins.text}{"”"}
                  </p>
                ) : (
                  <p className="m-0 font-serif text-[14px] italic leading-[1.6] text-fg [text-wrap:pretty]">
                    {ins.text}
                  </p>
                )}
              </div>
              <span
                className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-md border bg-transparent px-3.5 py-1.5 text-[12px] font-medium mobile:self-start"
                style={{
                  color: meta.color,
                  borderColor: `color-mix(in srgb, ${meta.color} 25%, transparent)`,
                }}
              >
                {ins.cta}
                <Icon name="arrow-right" size={11} />
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
