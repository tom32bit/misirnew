"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { useDashboards } from "@/lib/hooks/useDashboard"
import type { DashboardPayload, ReportPeriod, Space } from "@/lib/api/types"
import {
  countCriticalGaps,
  deriveReadiness,
  sumCaptures,
} from "@/lib/api/adapters"
import { Hero } from "./Hero"
import { InsightList } from "./InsightList"
import { SpacePulseStrip } from "./SpacePulseStrip"

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
  const sp = useSearchParams()
  const period = (sp.get("period") ?? "week") as ReportPeriod
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

  return (
    <>
      <Hero
        userName={user?.firstName ?? user?.username ?? "there"}
        vms={vms}
        totalCaptures={totalCaptures}
        totalCritical={totalCritical}
      />
      <InsightList vms={vms} period={period} />
      <SpacePulseStrip vms={vms} />
    </>
  )
}
