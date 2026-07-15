"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { useDashboards } from "@/lib/hooks/useDashboard"
import { usePeriodParams } from "@/lib/hooks/usePeriodParams"
import type { DashboardPayload, Space } from "@/lib/api/types"
import {
  countCriticalGaps,
  deriveReadiness,
  sumCaptures,
} from "@/lib/api/adapters"
import { Hero } from "./Hero"
import { InsightList } from "./InsightList"
import { StatStrip, UpNext, Connections, RecentCaptures, Tensions } from "./HomePanels"
import { Skeleton } from "@/components/misir/primitives/Skeleton"

/**
 * Build a single dashboard-derived view-model for each space so all
 * child components can read uniform fields (readiness%, capturesWeek,
 * criticalGaps) without re-deriving inline.
 */
export type SpaceVM = {
  space: Space
  readiness: number
  capturesWeek: number
  criticalGaps: number
  loading: boolean
  dashboard: DashboardPayload | undefined
}

export function HomeAll() {
  const router = useRouter()
  const { period, date, tzOffset } = usePeriodParams()
  const { user } = useUser()
  const { data: spaces = [], isLoading } = useSpaces()
  useEffect(() => {
    if (!isLoading && spaces.length === 0) {
      router.replace("/onboarding")
    }
  }, [isLoading, spaces.length, router])
  const dashboards = useDashboards(
    spaces.map((s) => s.id),
    period,
    tzOffset,
    date,
  )

  const vms: SpaceVM[] = spaces.map((space, i) => {
    const q = dashboards[i]
    const dash = q?.data as DashboardPayload | undefined
    return {
      space,
      readiness: deriveReadiness(dash),
      capturesWeek: sumCaptures(dash),
      criticalGaps: countCriticalGaps(dash),
      loading: !q || q.isLoading,
      dashboard: dash,
    }
  })

  const totalCaptures = vms.reduce((s, v) => s + v.capturesWeek, 0)
  const totalCritical = vms.reduce((s, v) => s + v.criticalGaps, 0)

  if (!isLoading && spaces.length === 0) return null

  // While spaces or ALL dashboards are still in flight, render a skeleton
  // that mirrors the final layout — otherwise the hero flashes its
  // zero-capture welcome copy and panels pop in one by one.
  if (isLoading || (vms.length > 0 && vms.every((v) => v.loading))) {
    return <HomeSkeleton />
  }

  return (
    <>
      <Hero
        userName={user?.firstName ?? user?.username ?? "there"}
        vms={vms}
        totalCaptures={totalCaptures}
        totalCritical={totalCritical}
      />
      <StatStrip vms={vms} totalCaptures={totalCaptures} />
      <UpNext vms={vms} />
      <InsightList vms={vms} period={period} />
      <Connections vms={vms} />
      <RecentCaptures vms={vms} />
      <Tensions vms={vms} />
    </>
  )
}

/** Layout-mirroring skeleton: hero (text left, space cards right), stat strip, one list. */
function HomeSkeleton() {
  return (
    <>
      <div
        className="grid gap-8 rounded-panel border border-border bg-bg p-8 mobile:grid-cols-1 mobile:gap-5 mobile:p-4"
        style={{ gridTemplateColumns: "minmax(0,1fr) 260px" }}
      >
        <div className="min-w-0">
          <Skeleton className="mb-5 h-3 w-44" />
          <div className="mb-6 flex flex-col gap-2.5">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-7 w-2/3" />
          </div>
          <Skeleton className="h-[30px] w-36 rounded-md" />
        </div>
        <div className="flex flex-col gap-2 mobile:flex-row mobile:flex-wrap">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border bg-bg-subtle px-3.5 py-2.5"
            >
              <Skeleton className="h-9 w-9 flex-none rounded-full" />
              <div className="flex-1">
                <Skeleton className="mb-1.5 h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 overflow-hidden rounded-panel border border-border bg-bg mobile:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`px-5 py-3.5 ${i > 0 ? "border-l border-border" : ""}`}>
            <Skeleton className="mb-2 h-6 w-12" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>

      <div>
        <Skeleton className="mb-2 h-4 w-40" />
        <div className="overflow-hidden rounded-panel border border-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border bg-bg px-4 py-3 last:border-b-0">
              <Skeleton className="h-6 w-6 flex-none rounded-md" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3 w-14 flex-none" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
