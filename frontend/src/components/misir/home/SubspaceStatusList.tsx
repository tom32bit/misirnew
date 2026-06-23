"use client"

import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Icon } from "@/components/misir/primitives/Icon"
import { Card, ProgressBar } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  const flag = vm.flag

  return (
    <Card
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
      className={cn(
        "h-[148px] cursor-pointer border-t-[3px] transition-colors hover:bg-bg-muted focus-visible:outline-none",
        flag === "critical" && "bg-[rgba(255,108,60,0.02)]",
        flag === "low" && "opacity-75",
      )}
      style={{ borderTopColor: color } as React.CSSProperties}
    >
      <div className="flex h-full flex-col p-4">
        {/* Name — grows to fill vertical space */}
        <p className="flex-1 font-serif text-[13.5px] font-semibold leading-snug text-fg">
          {subspace.name}
        </p>

        {/* Badge (only when flagged) */}
        {flag === "critical" && (
          <div className="mb-3">
            <Badge variant="revisit">
              <Icon name="alert-circle" size={10} />
              Critical
            </Badge>
          </div>
        )}
        {flag === "low" && (
          <div className="mb-3">
            <Badge
              variant="secondary"
              className="font-semibold uppercase tracking-[0.08em]"
            >
              <Icon name="alert-triangle" size={10} />
              Needs pull
            </Badge>
          </div>
        )}

        {/* Progress + stats pinned to bottom */}
        <div className="flex flex-col gap-1.5">
          <ProgressBar value={vm.completeness} color={color} />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-fg-subtle">
              {vm.captures} capture{vm.captures === 1 ? "" : "s"}
              {vm.weekDelta > 0 && (
                <span className="ml-1 font-semibold" style={{ color }}>
                  +{vm.weekDelta}
                </span>
              )}
            </span>
            <span
              className="font-mono text-[11px] font-semibold tracking-wide"
              style={{ color }}
            >
              {vm.completeness}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
