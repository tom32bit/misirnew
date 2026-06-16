"use client"

import Link from "next/link"
import { getSpaceColor } from "@/lib/constants/space-colors"
import type { SpaceVM } from "./HomeAll"

export function SpacePulseStrip({ vms }: { vms: SpaceVM[] }) {
  if (vms.length === 0) return null

  return (
    <div className="mt-1 grid gap-2.5 grid-cols-4 mobile:grid-cols-2">
      {vms.map((v) => (
        <SpacePulseCard key={v.space.id} vm={v} />
      ))}
    </div>
  )
}

function SpacePulseCard({ vm }: { vm: SpaceVM }) {
  const color = getSpaceColor(vm.space)

  return (
    <Link
      href={`/dashboard/${vm.space.id}/home`}
      className="flex flex-col gap-2 rounded-lg border border-border bg-bg px-4 py-3.5 text-left transition-colors hover:bg-bg-subtle"
      style={{
        ["--sc" as string]: color,
        borderColor: undefined,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-[7px] w-[7px] flex-none rounded-full"
          style={{ background: color }}
        />
        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-fg">
          {vm.space.name}
        </span>
        {vm.criticalGaps > 0 && (
          <span
            className="flex-none rounded-sm bg-[rgba(255,108,60,0.12)] px-1.5 py-px font-mono text-[10px] font-semibold text-accent"
          >
            {vm.criticalGaps}
          </span>
        )}
      </div>

      <div className="h-[3px] w-full overflow-hidden rounded-[3px] bg-border-strong">
        <div
          className="h-full rounded-[inherit] transition-[width] duration-[400ms] ease-out"
          style={{ width: `${vm.readiness}%`, background: color }}
        />
      </div>

      <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-fg-muted">
        <span className="font-semibold" style={{ color }}>
          {vm.readiness}%
        </span>
        <span className="ml-auto">{vm.capturesWeek} cap</span>
      </div>
    </Link>
  )
}
