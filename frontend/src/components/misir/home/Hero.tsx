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

        <CaptureRhythm vms={vms} />
      </div>

      {/* Right column — spaces, ordered by momentum */}
      <div className="flex flex-col gap-2 mobile:flex-row mobile:flex-wrap">
        {[...vms]
          .sort((a, b) => b.readiness - a.readiness || b.capturesWeek - a.capturesWeek)
          .map((v) => (
            <SpaceRingButton key={v.space.id} vm={v} />
          ))}
        {vms.length === 0 && (
          <div className="text-[12px] text-fg-subtle">No spaces yet.</div>
        )}
      </div>
    </section>
  )
}

/**
 * Capture rhythm — a real 14-day histogram of when you captured, bucketed from
 * the actual `activity[].time` (captured_at) timestamps across all spaces. It
 * only renders when there ARE dated captures to show; if the data has no parsable
 * dates it hides itself rather than fake a chart.
 */
function CaptureRhythm({ vms }: { vms: SpaceVM[] }) {
  const DAYS = 14
  const counts = new Array(DAYS).fill(0)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  let total = 0

  for (const vm of vms) {
    for (const a of vm.dashboard?.activity ?? []) {
      const t = new Date(a.time)
      if (Number.isNaN(t.getTime())) continue
      const dayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
      const daysAgo = Math.round((todayStart - dayStart) / 86_400_000)
      if (daysAgo >= 0 && daysAgo < DAYS) {
        counts[DAYS - 1 - daysAgo] += 1
        total += 1
      }
    }
  }

  if (total === 0) return null
  const max = Math.max(...counts, 1)

  return (
    <div className="mt-[34px] border-t border-border pt-6">
      <div className="mb-3.5 flex items-baseline justify-between">
        <span className="font-serif text-[14px] text-fg-muted">Capture rhythm</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-subtle">
          Last {DAYS} days
        </span>
      </div>
      <div className="flex h-[54px] items-end gap-[5px]">
        {counts.map((c, i) => {
          const h = c === 0 ? 3 : 8 + (c / max) * 44
          const isToday = i === DAYS - 1
          return (
            <div
              key={i}
              title={`${c} capture${c === 1 ? "" : "s"}`}
              className="flex-1 rounded-[3px]"
              style={{
                height: h,
                background: c === 0 ? "var(--border-strong)" : "#FF6C3C",
                opacity: c === 0 ? 0.45 : isToday ? 1 : 0.85,
              }}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-fg-subtle">
        <span>2 weeks ago</span>
        <span>today</span>
      </div>
    </div>
  )
}

/**
 * Readiness → the phase a space is in. Encoding momentum (rather than a uniform
 * "On track") is the whole point of the ring: at a glance you can see which
 * spaces are just seeds and which are maturing.
 */
function readinessTier(pct: number): { label: string; color: string } {
  if (pct <= 0) return { label: "Just started", color: "#8A857B" }
  if (pct < 15) return { label: "Seedling", color: "#B8730D" }
  if (pct < 30) return { label: "Building", color: "#FF6C3C" }
  if (pct < 60) return { label: "On track", color: "#2E7D55" }
  return { label: "Ready", color: "#2E7D55" }
}

function SpaceRingButton({ vm }: { vm: SpaceVM }) {
  const tier = readinessTier(vm.readiness)
  const hasCritical = vm.criticalGaps > 0
  // Critical gaps take over the colour (they're the thing to act on); otherwise
  // the ring shows the readiness phase.
  const ringColor = hasCritical ? getSpaceColor(vm.space) : tier.color

  return (
    <Link
      href={`/dashboard/${vm.space.id}/home`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-bg-subtle px-3.5 py-2.5 text-left transition-colors hover:bg-bg-muted mobile:flex-1 mobile:min-w-[140px]"
      style={{ ["--sc" as string]: ringColor }}
    >
      <ReadinessRing
        value={vm.readiness}
        size={36}
        thickness={5}
        color={ringColor}
        showPercent
        fontSize={10}
        trackColor="var(--border-strong)"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap font-serif text-[12.5px] font-medium text-fg">
          {vm.space.name}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide">
          {hasCritical ? (
            <span style={{ color: getSpaceColor(vm.space) }}>
              {vm.criticalGaps} critical
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5" style={{ color: tier.color }}>
              <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: tier.color }} />
              {tier.label}
            </span>
          )}
        </div>
      </div>
      {vm.capturesWeek > 0 && (
        <span className="flex-none font-mono text-[10px] tracking-wide text-fg-subtle">
          {vm.capturesWeek}
        </span>
      )}
    </Link>
  )
}
