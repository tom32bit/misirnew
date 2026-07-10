"use client"

import { useRouter } from "next/navigation"
import { Card, ProgressBar } from "@/components/ui/card"
import { getSubspaceColor } from "@/lib/constants/subspace-colors"
import type { Subspace } from "@/lib/api/types"
import type { SubspaceVM } from "@/lib/api/capture-adapters"

export function SubspaceStatusList({
  spaceId,
  subspaces,
  vms,
}: {
  spaceId: number
  subspaces: Subspace[]
  vms: SubspaceVM[]
}) {
  if (subspaces.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-bg p-8 text-center text-[13px] text-fg-subtle">
        No subspaces yet. Misir generates these when you capture content.
      </div>
    )
  }

  const byId = new Map<number, SubspaceVM>()
  for (const v of vms) byId.set(v.id, v)

  return (
    <div className="grid grid-cols-3 gap-3 mobile:grid-cols-2">
      {subspaces.map((s) => {
        const vm = byId.get(s.id) ?? {
          id: s.id,
          name: s.name,
          description: s.description,
          captures: 0,
          weekDelta: 0,
          completeness: 0,
          lastHit: "—",
        }
        return <SubspaceCard key={s.id} spaceId={spaceId} subspace={s} vm={vm} />
      })}
    </div>
  )
}

function SubspaceCard({
  spaceId,
  subspace,
  vm,
}: {
  spaceId: number
  subspace: Subspace
  vm: SubspaceVM
}) {
  const router = useRouter()
  const color = getSubspaceColor(subspace)
  const started = vm.captures > 0
  const go = () =>
    router.push(`/dashboard/${spaceId}/collection?sub=${subspace.id}`)

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          go()
        }
      }}
      className={[
        "flex h-[150px] cursor-pointer flex-col gap-3 rounded-[14px] p-[18px]",
        "transition-[transform,border-color,background-color] duration-150",
        "hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-muted",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
      ].join(" ")}
    >
      {/* Title with a small identity dot (replaces the loud colored top rail) */}
      <div className="flex items-center gap-2.5">
        <span
          className="h-2 w-2 flex-none rounded-full"
          style={{ background: color, boxShadow: `0 0 0 3px ${color}22` }}
        />
        <span className="font-sans text-[14.5px] font-medium leading-none tracking-[-0.01em] text-fg first-letter:uppercase">
          {subspace.name}
        </span>
      </div>

      {subspace.description && (
        <p className="m-0 line-clamp-2 text-[12.5px] leading-[1.5] text-fg-subtle [text-wrap:pretty]">
          {subspace.description}
        </p>
      )}

      {/* Calm status — no alarming CRITICAL badge. Empty reads as "just starting". */}
      <div className="mt-auto flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <ProgressBar value={vm.completeness} color={color} className="flex-1" />
          <span className="whitespace-nowrap text-[11px] tabular-nums text-fg-faint">
            {vm.captures} source{vm.captures === 1 ? "" : "s"}
          </span>
        </div>
        {started ? (
          <span
            className="inline-flex items-center gap-1.5 text-[11px]"
            style={{ color }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {vm.completeness}% ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-subtle">
            <span className="h-2 w-2 rounded-full border-[1.5px] border-fg-faint" />
            Not started
          </span>
        )}
      </div>
    </Card>
  )
}
