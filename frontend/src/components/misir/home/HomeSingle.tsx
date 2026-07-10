"use client"

import { useMemo } from "react"
import { useSpace } from "@/lib/hooks/useSpaces"
import { useSubspaces } from "@/lib/hooks/useSubspaces"
import { useArtifacts } from "@/lib/hooks/useArtifacts"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { useGaps } from "@/lib/hooks/useGaps"
import { useDeadline } from "@/lib/hooks/useDeadline"
import { usePeriodParams } from "@/lib/hooks/usePeriodParams"
import {
  countCriticalGaps,
  deriveReadiness,
  sumCaptures,
} from "@/lib/api/adapters"
import {
  adaptCaptures,
  adaptSubspaces,
} from "@/lib/api/capture-adapters"
import { getSpaceColor } from "@/lib/constants/space-colors"
import { useUIStore } from "@/lib/stores/ui-store"

import { Icon } from "@/components/misir/primitives/Icon"
import { Skeleton } from "@/components/misir/primitives/Skeleton"
import {
  Card,
  CardHeader,
  SectionHead,
} from "@/components/misir/primitives/Card"
import { MisirBrief } from "./MisirBrief"
import { MisirAsks } from "./MisirAsks"
import { SubspaceStatusList } from "./SubspaceStatusList"
import { TodayTimeline } from "./TodayTimeline"

export function HomeSingle({ spaceId }: { spaceId: number }) {
  const { period, date, tzOffset } = usePeriodParams()
  const openModal = useUIStore((s) => s.openModal)

  const space = useSpace(spaceId)
  const subspaces = useSubspaces(spaceId)
  // Recent-captures card: latest captures in the current window (no day picker).
  const artifactsRecent = useArtifacts({ spaceId, period, date, tzOffset, limit: 50 }, 30_000)
  const artifactsAll = useArtifacts({ spaceId, period, date, tzOffset, limit: 200 })
  const dashboard = useDashboard(spaceId, period, tzOffset, date)
  const gaps = useGaps(spaceId)
  const deadline = useDeadline(spaceId)

  const color = useMemo(
    () => getSpaceColor(space.data ?? { id: spaceId, name: "" }),
    [space.data, spaceId],
  )

  const readiness = deriveReadiness(dashboard.data)
  const criticalGaps = (gaps.data ?? []).filter(
    (g) => g.severity === "Critical",
  ).length || countCriticalGaps(dashboard.data)
  const capturesWeek = sumCaptures(dashboard.data)

  const subspaceVMs = useMemo(
    () =>
      adaptSubspaces(
        subspaces.data ?? [],
        artifactsAll.data ?? [],
        dashboard.data?.research_depth,
        dashboard.data?.subspaces,
        undefined,
        period,
      ),
    [
      subspaces.data,
      artifactsAll.data,
      dashboard.data?.research_depth,
      dashboard.data?.subspaces,
      period,
    ],
  )

  const recentCaptures = useMemo(
    () => adaptCaptures(artifactsRecent.data ?? [], new Date(), subspaces.data ?? []),
    [artifactsRecent.data, subspaces.data],
  )

  if (space.isLoading && !space.data) {
    return <HomeSingleSkeleton />
  }

  if (space.isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-bg px-6 py-12 text-center">
        <Icon name="alert-triangle" size={18} className="text-fg-subtle" />
        <div className="text-[14px] font-medium text-fg">Couldn&apos;t load this space</div>
        <div className="text-[13px] text-fg-muted">Check your connection and try again.</div>
        <button
          onClick={() => space.refetch()}
          className="mt-1 rounded-md border border-border-strong bg-bg px-4 py-2 text-[13px] text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
        >
          Retry
        </button>
      </div>
    )
  }

  const ch = space.data

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-[18px]">
      <MisirBrief
        space={ch}
        deadline={deadline.data ?? null}
        readiness={readiness}
        color={color}
        capturesWeek={capturesWeek}
        subspaceCount={subspaces.data?.length ?? 0}
        misirRead={dashboard.data?.misirs_read}
        criticalGaps={criticalGaps}
        onChat={() => openModal({ kind: "new-chat", defaultSpaceId: spaceId })}
      />

      {ch && (
        <MisirAsks
          space={ch}
          subspaces={subspaces.data ?? []}
          gaps={gaps.data ?? []}
          color={color}
        />
      )}

      <SectionHead title="Subspaces" />
      <SubspaceStatusList
        spaceId={spaceId}
        subspaces={subspaces.data ?? []}
        vms={subspaceVMs}
      />

      <Card className="p-0">
        <CardHeader>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
            Recent · {recentCaptures.length} capture
            {recentCaptures.length === 1 ? "" : "s"}
          </span>
        </CardHeader>
        <TodayTimeline
          spaceId={spaceId}
          captures={recentCaptures}
          subspaces={subspaces.data ?? []}
        />
      </Card>
    </div>
  )
}


function HomeSingleSkeleton() {
  return (
    <>
      {/* MisirBrief skeleton */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-6">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <div className="mt-1 flex gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* MisirAsks skeleton */}
      <Skeleton className="h-[54px] w-full rounded-xl" />
      {/* Subspaces skeleton */}
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="grid overflow-hidden rounded-xl border border-border bg-bg"
            style={{ gridTemplateColumns: "5px 1fr" }}
          >
            <div className="bg-bg-muted" />
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="ml-auto h-1.5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
