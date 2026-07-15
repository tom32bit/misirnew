"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { Icon } from "@/components/misir/primitives/Icon"
import { CountUp } from "@/components/misir/primitives/CountUp"
import { SectionHead } from "@/components/misir/primitives/Card"
import { getSpaceColor } from "@/lib/constants/space-colors"
import { platformLabel } from "@/lib/constants/surface-icons"
import { SPRING, reveal } from "@/lib/motion"
import type { SpaceVM } from "./HomeAll"

/** next/link with motion props (hover lift, tap, entrance). */
const MotionLink = motion.create(Link)

const SEV_RANK: Record<string, number> = { Critical: 3, High: 2, Medium: 1 }

/** Compact relative time from an ISO timestamp (e.g. "3h", "2d", "Jul 4"). */
function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm border border-border px-[6px] py-px font-mono text-[9.5px] uppercase tracking-wide text-fg-subtle">
      {children}
    </span>
  )
}

/* ── Stat strip — quick numbers under the hero ──────────────────────────── */
export function StatStrip({ vms, totalCaptures }: { vms: SpaceVM[]; totalCaptures: number }) {
  const ready = vms.filter((v) => !v.loading)
  const avg = ready.length ? Math.round(ready.reduce((s, v) => s + v.readiness, 0) / ready.length) : 0
  const connections = vms.reduce((s, v) => s + (v.dashboard?.cross_space?.length ?? 0), 0)
  const stats = [
    { n: totalCaptures, suffix: "", l: "Captures", icon: "bookmark" },
    { n: vms.length, suffix: "", l: "Spaces", icon: "target" },
    { n: avg, suffix: "%", l: "Avg readiness", icon: "gauge" },
    { n: connections, suffix: "", l: "Connections", icon: "link-2" },
  ]
  return (
    <motion.div
      {...reveal}
      className="grid grid-cols-4 overflow-hidden rounded-panel border border-border bg-bg mobile:grid-cols-2"
    >
      {stats.map((s, i) => (
        <div
          key={s.l}
          className={`px-5 py-3.5 ${i > 0 ? "border-l border-border" : ""} mobile:[&:nth-child(2)]:border-l-0 mobile:[&:nth-child(n+3)]:border-t mobile:border-border`}
        >
          <div className="font-display text-[22px] font-semibold tabular-nums leading-none text-fg">
            <CountUp value={s.n} suffix={s.suffix} />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-subtle">
            <Icon name={s.icon} size={11} className="flex-none" />
            {s.l}
          </div>
        </div>
      ))}
    </motion.div>
  )
}

/* ── Up next — deadlines + top open gaps, ordered by urgency ─────────────── */
type UpNextItem = {
  icon: string
  primary: string
  sublabel?: string
  meta: string
  tone: string
  href: string
  sort: number
}

export function UpNext({ vms }: { vms: SpaceVM[] }) {
  const now = Date.now()
  const items: UpNextItem[] = []

  for (const vm of vms) {
    const d = vm.dashboard?.deadline
    if (d?.due_at) {
      const days = Math.ceil((new Date(d.due_at).getTime() - now) / 86_400_000)
      // The subject IS the space, so show it once — no redundant sub-line.
      const label = d.label && d.label !== vm.space.name ? d.label : vm.space.name
      items.push({
        icon: "flag",
        primary: label,
        sublabel: label === vm.space.name ? undefined : vm.space.name,
        meta: days < 0 ? `${-days}d overdue` : days === 0 ? "due today" : `${days}d left`,
        tone: days <= 3 ? "var(--color-danger)" : days <= 7 ? "var(--color-warning)" : "var(--color-success)",
        href: `/dashboard/${vm.space.id}/decision`,
        sort: days,
      })
    }
    const topGap = (vm.dashboard?.gaps ?? [])
      .filter((g) => g.status === "open")
      .sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0))[0]
    if (topGap) {
      items.push({
        icon: "git-branch",
        primary: topGap.label,
        sublabel: vm.space.name,
        meta: topGap.severity.toLowerCase(),
        tone: topGap.severity === "Critical" ? "var(--color-danger)" : topGap.severity === "High" ? "var(--color-warning)" : "var(--fg-subtle)",
        href: `/dashboard/${vm.space.id}/notification`,
        sort: 1000 + (3 - (SEV_RANK[topGap.severity] ?? 0)),
      })
    }
  }

  if (items.length === 0) return null
  items.sort((a, b) => a.sort - b.sort)

  return (
    <motion.section {...reveal}>
      <SectionHead icon="list-todo" title="Up next" small={`${items.length} to act on`} />
      <div className="mt-1.5 overflow-hidden rounded-panel border border-border">
        {items.slice(0, 5).map((it) => (
          <Link
            key={`${it.href}:${it.primary}`}
            href={it.href}
            className="flex items-center gap-2.5 border-b border-border bg-bg px-4 py-2 transition-colors last:border-b-0 hover:bg-bg-muted"
          >
            <span
              className="grid h-6 w-6 flex-none place-items-center rounded-md"
              style={{
                color: it.tone,
                background: `color-mix(in srgb, ${it.tone} 10%, transparent)`,
              }}
            >
              <Icon name={it.icon} size={12.5} />
            </span>
            <span className="min-w-0 flex-1 truncate font-serif text-[13.5px] text-fg">{it.primary}</span>
            {it.sublabel && (
              <span className="hidden flex-none font-mono text-[10.5px] text-fg-subtle sm:inline">{it.sublabel}</span>
            )}
            <span className="flex-none font-mono text-[11px] font-medium tabular-nums" style={{ color: it.tone }}>
              {it.meta}
            </span>
          </Link>
        ))}
      </div>
    </motion.section>
  )
}

/* ── Connections — cross-space links Misir found ────────────────────────── */
export function Connections({ vms }: { vms: SpaceVM[] }) {
  const links = vms.flatMap((vm) =>
    (vm.dashboard?.cross_space ?? []).map((c) => ({ c, space: vm.space })),
  )
  if (links.length === 0) return null
  const top = [...links].sort((a, b) => b.c.similarity - a.c.similarity).slice(0, 3)

  return (
    <motion.section {...reveal}>
      <SectionHead icon="link-2" title="Connections Misir found" small={`${links.length} across your spaces`} />
      <div className="mt-1.5 flex flex-col gap-2.5">
        {top.map(({ c, space }) => (
          <MotionLink
            key={`${space.id}:${c.source_title}:${c.target_gap}`}
            href="/dashboard/all/comparison"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            transition={SPRING.snap}
            className="block rounded-panel border border-border bg-bg p-4 transition-colors hover:bg-bg-muted"
          >
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-fg-subtle">
              <Icon name="link-2" size={11} style={{ color: getSpaceColor(space) }} className="flex-none" />
              <span style={{ color: getSpaceColor(space) }}>{space.name}</span>
              <Icon name="arrow-right" size={11} />
              <span>another space</span>
              <span className="ml-auto rounded-full border border-border px-2 py-px tabular-nums text-fg-muted">
                {Math.round(c.similarity * 100)}% match
              </span>
            </div>
            <div className="font-serif text-[14px] leading-[1.5] text-fg [text-wrap:pretty]">
              <span>“{c.source_title}”</span>
              <span className="text-fg-muted"> speaks to an open question — </span>
              <span className="italic">{c.target_gap}</span>
            </div>
          </MotionLink>
        ))}
      </div>
    </motion.section>
  )
}

/* ── Recently captured — latest activity across spaces ──────────────────── */
export function RecentCaptures({ vms }: { vms: SpaceVM[] }) {
  const items = vms
    .flatMap((vm) => (vm.dashboard?.activity ?? []).map((a) => ({ a, space: vm.space })))
    .filter((x) => !Number.isNaN(new Date(x.a.time).getTime()))
  if (items.length === 0) return null
  const top = items
    .sort((a, b) => new Date(b.a.time).getTime() - new Date(a.a.time).getTime())
    .slice(0, 5)

  return (
    <motion.section {...reveal}>
      <SectionHead icon="history" title="Recently captured" small={`across ${vms.length} space${vms.length === 1 ? "" : "s"}`} />
      <div className="mt-1.5 overflow-hidden rounded-panel border border-border">
        {top.map(({ a, space }) => {
          const color = getSpaceColor(space)
          return (
          <Link
            key={`${space.id}:${a.time}:${a.title}`}
            href={`/dashboard/${space.id}/collection`}
            className="flex items-center gap-4 border-b border-border bg-bg px-5 py-3 transition-colors last:border-b-0 hover:bg-bg-muted mobile:px-3"
          >
            {/* Letter tile — where this capture came from, tinted by its space. */}
            <span
              className="grid h-6 w-6 flex-none place-items-center rounded-md border text-[10.5px] font-semibold uppercase"
              style={{
                color,
                borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                background: `color-mix(in srgb, ${color} 8%, transparent)`,
              }}
            >
              {platformLabel(a.source).charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-[13.5px] text-fg">{a.title}</div>
              <div className="mt-0.5 font-mono text-[10px] text-fg-subtle">
                {space.name} · {platformLabel(a.source)}
              </div>
            </div>
            <div className="flex flex-none items-center gap-2">
              {a.revisit && <Badge>revisited</Badge>}
              {a.crossLink && <Badge>linked</Badge>}
              <span className="w-9 text-right font-mono text-[10px] tabular-nums text-fg-subtle">{relTime(a.time)}</span>
            </div>
          </Link>
          )
        })}
      </div>
    </motion.section>
  )
}

/* ── Tensions — the key tension in EACH space (cross-space overview) ─────── */
export function Tensions({ vms }: { vms: SpaceVM[] }) {
  const withTension = vms.filter(
    (vm) => vm.dashboard?.key_tension && (vm.dashboard.key_tension.edge || vm.dashboard.key_tension.points?.length),
  )
  if (withTension.length === 0) return null

  return (
    <motion.section {...reveal}>
      <SectionHead
        icon="scale"
        title="Where your sources differ"
        small={`${withTension.length} space${withTension.length === 1 ? "" : "s"}`}
      />
      <div className="mt-1.5 overflow-hidden rounded-panel border border-border bg-bg">
        {withTension.map((vm) => {
          const t = vm.dashboard!.key_tension!
          const summary = t.edge || t.points?.[0]?.text || ""
          const sources = (t.points ?? []).length
          return (
            <Link
              key={vm.space.id}
              href={`/dashboard/${vm.space.id}/comparison`}
              className="flex items-baseline gap-4 border-b border-border px-5 py-3 transition-colors last:border-b-0 hover:bg-bg-muted mobile:px-3"
            >
              <span className="flex w-[112px] flex-none items-center gap-2">
                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: getSpaceColor(vm.space) }} />
                <span className="truncate font-mono text-[10.5px] uppercase tracking-wide text-fg-subtle">
                  {vm.space.name}
                </span>
              </span>
              <span className="min-w-0 flex-1 font-serif text-[13.5px] leading-[1.45] text-fg [text-wrap:pretty]">
                {summary}
              </span>
              {sources > 0 && (
                <span className="hidden flex-none font-mono text-[10px] tabular-nums text-fg-subtle sm:inline">
                  {sources} sources
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </motion.section>
  )
}
