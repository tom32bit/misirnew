"use client"

import Link from "next/link"
import { Icon } from "@/components/misir/primitives/Icon"
import { SectionHead } from "@/components/misir/primitives/Card"
import { getSpaceColor } from "@/lib/constants/space-colors"
import type { SpaceVM } from "./HomeAll"

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
    { n: String(totalCaptures), l: "Captures" },
    { n: String(vms.length), l: "Spaces" },
    { n: `${avg}%`, l: "Avg readiness" },
    { n: String(connections), l: "Connections" },
  ]
  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-[10px] border border-border bg-bg mobile:grid-cols-2">
      {stats.map((s, i) => (
        <div
          key={s.l}
          className={`px-5 py-3.5 ${i > 0 ? "border-l border-border" : ""} mobile:[&:nth-child(2)]:border-l-0 mobile:[&:nth-child(n+3)]:border-t mobile:border-border`}
        >
          <div className="font-display text-[22px] font-semibold tabular-nums leading-none text-fg">{s.n}</div>
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-subtle">{s.l}</div>
        </div>
      ))}
    </div>
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
        tone: days <= 3 ? "#C0392B" : days <= 7 ? "#B8730D" : "#2E7D55",
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
        tone: topGap.severity === "Critical" ? "#C0392B" : topGap.severity === "High" ? "#B8730D" : "#6E6862",
        href: `/dashboard/${vm.space.id}/notification`,
        sort: 1000 + (3 - (SEV_RANK[topGap.severity] ?? 0)),
      })
    }
  }

  if (items.length === 0) return null
  items.sort((a, b) => a.sort - b.sort)

  return (
    <section>
      <SectionHead title="Up next" small={`${items.length} to act on`} />
      <div className="mt-1.5 overflow-hidden rounded-[10px] border border-border">
        {items.slice(0, 5).map((it, i) => (
          <Link
            key={i}
            href={it.href}
            className="flex items-center gap-2.5 border-b border-border bg-bg px-4 py-2 transition-colors last:border-b-0 hover:bg-bg-muted"
          >
            <Icon name={it.icon} size={13} style={{ color: it.tone }} className="flex-none" />
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
    </section>
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
    <section>
      <SectionHead title="Connections Misir found" small={`${links.length} across your spaces`} />
      <div className="mt-1.5 flex flex-col gap-2.5">
        {top.map(({ c, space }, i) => (
          <Link
            key={i}
            href="/dashboard/all/comparison"
            className="block rounded-[10px] border border-border bg-bg p-4 transition-colors hover:bg-bg-muted"
          >
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-fg-subtle">
              <span style={{ color: getSpaceColor(space) }}>{space.name}</span>
              <Icon name="arrow-right" size={11} />
              <span>another space</span>
              <span className="ml-auto tabular-nums">{Math.round(c.similarity * 100)}% match</span>
            </div>
            <div className="font-serif text-[14px] leading-[1.5] text-fg [text-wrap:pretty]">
              <span>“{c.source_title}”</span>
              <span className="text-fg-muted"> speaks to an open question — </span>
              <span className="italic">{c.target_gap}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
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
    <section>
      <SectionHead title="Recently captured" small={`across ${vms.length} space${vms.length === 1 ? "" : "s"}`} />
      <div className="mt-1.5 overflow-hidden rounded-[10px] border border-border">
        {top.map(({ a, space }, i) => (
          <Link
            key={i}
            href={`/dashboard/${space.id}/collection`}
            className="flex items-center gap-4 border-b border-border bg-bg px-5 py-3 transition-colors last:border-b-0 hover:bg-bg-muted mobile:px-3"
          >
            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: getSpaceColor(space) }} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-[13.5px] text-fg">{a.title}</div>
              <div className="mt-0.5 font-mono text-[10px] text-fg-subtle">
                {space.name} · {a.source}
              </div>
            </div>
            <div className="flex flex-none items-center gap-2">
              {a.revisit && <Badge>revisited</Badge>}
              {a.crossLink && <Badge>linked</Badge>}
              <span className="w-9 text-right font-mono text-[10px] tabular-nums text-fg-subtle">{relTime(a.time)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ── Tensions — the key tension in EACH space (cross-space overview) ─────── */
export function Tensions({ vms }: { vms: SpaceVM[] }) {
  const withTension = vms.filter(
    (vm) => vm.dashboard?.key_tension && (vm.dashboard.key_tension.edge || vm.dashboard.key_tension.points?.length),
  )
  if (withTension.length === 0) return null

  return (
    <section>
      <SectionHead
        title="Where your sources differ"
        small={`${withTension.length} space${withTension.length === 1 ? "" : "s"}`}
      />
      <div className="mt-1.5 overflow-hidden rounded-[10px] border border-border bg-bg">
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
    </section>
  )
}
