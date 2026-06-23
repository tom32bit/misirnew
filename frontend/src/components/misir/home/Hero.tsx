"use client"

import Link from "next/link"
import { Icon } from "@/components/misir/primitives/Icon"
import { ReadinessRing } from "@/components/misir/primitives/ReadinessRing"
import { getSpaceColor } from "@/lib/constants/space-colors"
import type { SpaceVM } from "./HomeAll"

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

type Moment = { lines: string[]; cta: string; href: string }

function buildMoment(vms: SpaceVM[], totalCaptures: number, totalCritical: number): Moment {
  const ACCENT = "#FF6C3C"

  if (totalCaptures === 0) {
    return {
      lines: [
        "Your space is live.",
        "Start capturing what you're reading.",
        "Misir will synthesise as you go.",
      ],
      cta: "Open collection",
      href: "/dashboard/all/collection",
    }
  }

  if (totalCritical > 0) {
    return {
      lines: [
        `${totalCritical} critical gap${totalCritical === 1 ? "" : "s"} need your attention.`,
        "The groundwork is there.",
        "Now close the gaps before you decide.",
      ],
      cta: "Decision tree",
      href: "/dashboard/all/decision",
    }
  }

  const readiest = vms
    .filter((v) => !v.loading && v.capturesWeek > 0)
    .sort((a, b) => b.readiness - a.readiness)[0]

  if (readiest && readiest.readiness >= 70) {
    return {
      lines: [
        `${readiest.space.name} is at ${readiest.readiness}%.`,
        "You may have enough to decide.",
        "Review what you know.",
      ],
      cta: "See decision",
      href: `/dashboard/${readiest.space.id}/decision`,
    }
  }

  const spaces = vms.length
  return {
    lines: [
      `${totalCaptures} capture${totalCaptures === 1 ? "" : "s"} across ${spaces} space${spaces === 1 ? "" : "s"}.`,
      "Misir is building your synthesis.",
      "Keep capturing — the picture is forming.",
    ],
    cta: "Open collection",
    href: "/dashboard/all/collection",
  }
}

export function Hero({
  userName,
  vms,
  totalCaptures,
  totalCritical,
}: {
  userName: string
  vms: SpaceVM[]
  totalCaptures: number
  totalCritical: number
}) {
  const moment = buildMoment(vms, totalCaptures, totalCritical)

  return (
    <section
      className="grid gap-8 rounded-xl border border-border bg-bg p-8 mobile:grid-cols-1 mobile:gap-5 mobile:p-4"
      style={{ gridTemplateColumns: "minmax(0,1fr) 260px" }}
    >
      <div className="min-w-0">
        <div className="mb-[18px] font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
          {greeting()}, {userName}.
        </div>

        <div className="mb-[22px] flex flex-col gap-0.5">
          {moment.lines.map((line, i) => (
            <span
              key={i}
              className="block font-display text-[30px] font-semibold leading-[1.15] tracking-[-0.025em] text-fg mobile:text-[22px]"
              style={i === 2 ? { color: "#FF6C3C", fontStyle: "italic" } : undefined}
            >
              {line}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={moment.href}
            className="inline-flex h-[30px] items-center gap-1.5 rounded-md border bg-transparent px-3.5 text-[12.5px] font-medium transition-colors hover:bg-bg-muted"
            style={{
              color: "#FF6C3C",
              borderColor: "color-mix(in srgb, #FF6C3C 30%, transparent)",
            }}
          >
            {moment.cta}
            <Icon name="arrow-right" size={12} />
          </Link>
          <span className="font-mono text-[10.5px] tracking-wide text-fg-subtle">
            {totalCaptures} capture{totalCaptures === 1 ? "" : "s"} · {totalCritical} critical gap
            {totalCritical === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Right column — space ring buttons */}
      <div className="flex flex-col gap-2 mobile:flex-row mobile:flex-wrap">
        {vms.map((v) => (
          <SpaceRingButton key={v.space.id} vm={v} />
        ))}
        {vms.length === 0 && (
          <div className="text-[12px] text-fg-subtle">No spaces yet.</div>
        )}
      </div>
    </section>
  )
}

function SpaceRingButton({ vm }: { vm: SpaceVM }) {
  const color = getSpaceColor(vm.space)
  const status =
    vm.criticalGaps > 0 ? (
      <span style={{ color }}>{vm.criticalGaps} critical</span>
    ) : (
      <span className="text-success">On track</span>
    )

  return (
    <Link
      href={`/dashboard/${vm.space.id}/home`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-bg-subtle px-3.5 py-2.5 text-left transition-colors hover:bg-bg-muted mobile:flex-1 mobile:min-w-[140px]"
      style={{ ["--sc" as string]: color }}
    >
      <ReadinessRing
        value={vm.readiness}
        size={36}
        thickness={5}
        color={color}
        showPercent
        fontSize={10}
        trackColor="var(--border-strong)"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap font-serif text-[12.5px] font-medium text-fg">
          {vm.space.name}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide">
          {status}
        </div>
      </div>
    </Link>
  )
}
