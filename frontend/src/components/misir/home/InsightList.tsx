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
  nudge:       { label: "Nudge",       icon: "zap",        color: "#FF6C3C", bg: "rgba(255,108,60,0.03)"  },
  gap:         { label: "Gap",         icon: "git-branch", color: "#C0392B", bg: "rgba(192,57,43,0.03)"   },
  cross_space: { label: "Cross-space", icon: "link-2",     color: "#2A4A7A", bg: "rgba(42,74,122,0.03)"   },
  activity:    { label: "Activity",    icon: "activity",   color: "#2E7D55", bg: "rgba(46,125,85,0.03)"    },
  synthesis:   { label: "Synthesis",   icon: "layers",     color: "#6E6862", bg: "rgba(110,104,98,0.03)"   },
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
        title="What Misir noticed"
        small={`${insights.length} thing${insights.length === 1 ? "" : "s"} worth knowing`}
      />

      <div className="overflow-hidden rounded-[10px] border border-border">
        {insights.map((ins, i) => {
          const meta = TYPE_META[ins.type]
          return (
            <Link
              key={i}
              href={ins.href}
              className="grid items-center gap-5 border-b border-border bg-bg px-5 py-5 transition-colors last:border-b-0 hover:bg-[var(--ins-bg)] mobile:grid-cols-[28px_1fr] mobile:gap-y-1.5 mobile:gap-x-2.5 mobile:px-3"
              style={
                {
                  gridTemplateColumns: "36px 130px 1fr auto",
                  ["--ins-bg" as string]: meta.bg,
                } as React.CSSProperties
              }
            >
              <div className="font-mono text-[11px] tracking-wide text-fg-faint mobile:row-start-1 mobile:self-start mobile:pt-0.5">
                {String(i + 1).padStart(2, "0")}
              </div>

              <div className="flex min-w-0 flex-col gap-2 overflow-hidden mobile:row-start-1">
                <span
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: meta.color }}
                >
                  <Icon name={meta.icon} size={12} />
                  {meta.label}
                </span>
                {ins.chips.length > 0 && (
                  <div className="flex flex-wrap gap-1 overflow-hidden">
                    {ins.chips.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex min-w-0 max-w-full items-center rounded-sm border px-[7px] py-px text-[10.5px] font-medium"
                        style={{
                          color: meta.color,
                          borderColor: `color-mix(in srgb, ${meta.color} 30%, transparent)`,
                          background: `color-mix(in srgb, ${meta.color} 7%, transparent)`,
                        }}
                      >
                        <span className="truncate">{c.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[14.5px] leading-[1.6] text-fg [text-wrap:pretty] mobile:col-span-2 mobile:text-[13px]">
                {ins.text}
              </p>

              <span
                className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-md border bg-transparent px-3.5 py-1.5 text-[12px] font-medium mobile:col-span-2 mobile:justify-self-start"
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
