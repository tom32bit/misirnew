"use client"

import { useRouter } from "next/navigation"
import { Icon } from "@/components/misir/primitives/Icon"
import { getSubspaceColor } from "@/lib/constants/subspace-colors"
import { statusForSubspace } from "@/lib/constants/subspace-status"
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

  // Index VMs by id so callers can pass `vms` from anywhere.
  const byId = new Map<number, SubspaceVM>()
  for (const v of vms) byId.set(v.id, v)

  return (
    <div className="overflow-hidden rounded-[10px] border border-border">
      {subspaces.map((s) => {
        const vm =
          byId.get(s.id) ?? {
            id: s.id,
            name: s.name,
            description: s.description,
            captures: 0,
            weekDelta: 0,
            completeness: 0,
            lastHit: "—",
          }
        return <SubspaceStatusRow key={s.id} spaceId={spaceId} subspace={s} vm={vm} />
      })}
    </div>
  )
}

function SubspaceStatusRow({
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
  const status = statusForSubspace(subspace.name, {
    captures: vm.captures,
    completeness: vm.completeness,
  })
  const flag = vm.flag

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() =>
        router.push(`/dashboard/${spaceId}/collection?sub=${subspace.id}`)
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          router.push(`/dashboard/${spaceId}/collection?sub=${subspace.id}`)
        }
      }}
      className={[
        "grid cursor-pointer border-b border-border bg-bg pr-[18px] pl-0 py-3.5 transition-colors last:border-b-0 hover:bg-bg-muted",
        flag === "critical" ? "bg-[rgba(255,108,60,0.03)] hover:bg-[rgba(255,108,60,0.06)]" : "",
        flag === "low" ? "opacity-80" : "",
      ].join(" ")}
      style={{
        gridTemplateColumns: "5px 1fr auto",
        gridTemplateRows: "auto auto auto",
        columnGap: "18px",
      }}
    >
      {/* Lane bar spans all 3 rows */}
      <div
        className="rounded-r-sm"
        style={{
          gridRow: "1 / 4",
          gridColumn: "1",
          background: color,
          alignSelf: "stretch",
          width: 5,
        }}
      />

      {/* Head row */}
      <div
        className="flex items-center gap-2.5"
        style={{ gridColumn: "2", gridRow: "1" }}
      >
        <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-fg">
          {subspace.name}
        </span>
        {flag === "critical" && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-[rgba(255,108,60,0.10)] px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-accent">
            <Icon name="alert-circle" size={11} />
            Critical
          </span>
        )}
        {flag === "low" && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-bg-muted px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            <Icon name="alert-triangle" size={11} />
            Needs pull
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="flex items-center gap-2.5 pt-0.5"
        style={{ gridColumn: "3", gridRow: "1" }}
      >
        <div className="h-[3px] w-[80px] overflow-hidden rounded-[3px] bg-border-strong">
          <div
            className="h-full rounded-[inherit]"
            style={{ width: `${vm.completeness}%`, background: color }}
          />
        </div>
        <span
          className="min-w-[28px] text-right font-mono text-[11px] font-semibold tracking-wide"
          style={{ color }}
        >
          {vm.completeness}%
        </span>
      </div>

      {/* Status line */}
      <p
        className="m-0 mt-1.5 text-[12.5px] leading-[1.5] text-fg-muted"
        style={{ gridColumn: "2 / 4", gridRow: "2" }}
      >
        {status}
      </p>

      {/* Footer */}
      <div
        className="mt-1.5 flex items-center gap-2"
        style={{ gridColumn: "2 / 4", gridRow: "3" }}
      >
        <span className="font-mono text-[10.5px] text-fg-subtle">
          {vm.captures} capture{vm.captures === 1 ? "" : "s"}
        </span>
        {vm.weekDelta > 0 && (
          <span
            className="font-mono text-[10.5px] font-semibold"
            style={{ color }}
          >
            +{vm.weekDelta} this week
          </span>
        )}
        <span className="ml-auto font-mono text-[10.5px] text-fg-subtle">
          {vm.lastHit}
        </span>
      </div>
    </div>
  )
}
