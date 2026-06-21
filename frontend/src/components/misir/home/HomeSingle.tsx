"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSpace } from "@/lib/hooks/useSpaces"
import { useSubspaces } from "@/lib/hooks/useSubspaces"
import { useArtifacts } from "@/lib/hooks/useArtifacts"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { useGaps } from "@/lib/hooks/useGaps"
import { useDeadline } from "@/lib/hooks/useDeadline"
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
import type { ReportPeriod } from "@/lib/api/types"
import { useUIStore } from "@/lib/stores/ui-store"

import { Icon } from "@/components/misir/primitives/Icon"
import { ReadinessRing } from "@/components/misir/primitives/ReadinessRing"
import {
  Card,
  CardHeader,
  Spacer,
  SectionHead,
} from "@/components/misir/primitives/Card"
import { ChatCTA } from "@/components/misir/primitives/ChatCTA"
import { MisirBrief } from "./MisirBrief"
import { MisirAsks } from "./MisirAsks"
import { SubspaceStatusList } from "./SubspaceStatusList"
import { TodayTimeline } from "./TodayTimeline"

export function HomeSingle({ spaceId }: { spaceId: number }) {
  const sp = useSearchParams()
  const period = (sp.get("period") ?? "week") as ReportPeriod
  const openModal = useUIStore((s) => s.openModal)

  const space = useSpace(spaceId)
  const subspaces = useSubspaces(spaceId)
  const artifactsToday = useArtifacts({ spaceId, period: "today", limit: 50 })
  const artifactsAll = useArtifacts({ spaceId, period, limit: 200 })
  const dashboard = useDashboard(spaceId, period)
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
      ),
    [
      subspaces.data,
      artifactsAll.data,
      dashboard.data?.research_depth,
      dashboard.data?.subspaces,
    ],
  )

  const todayCaptures = useMemo(
    () => adaptCaptures(artifactsToday.data ?? []),
    [artifactsToday.data],
  )

  if (space.isLoading && !space.data) {
    return (
      <div className="rounded-lg border border-border bg-bg p-8 text-center text-[13px] text-fg-subtle">
        Loading space…
      </div>
    )
  }

  const ch = space.data

  return (
    <>
      <MisirBrief
        space={ch}
        deadline={deadline.data ?? null}
        readiness={readiness}
        color={color}
        capturesWeek={capturesWeek}
        subspaceCount={subspaces.data?.length ?? 0}
        misirRead={dashboard.data?.misirs_read}
      />

      {ch && (
        <MisirAsks
          space={ch}
          subspaces={subspaces.data ?? []}
          gaps={gaps.data ?? []}
          color={color}
        />
      )}

      <SectionHead
        title="Subspaces"
        small={`${subspaces.data?.length ?? 0} AI-generated topics`}
        right={
          <>
            <Link
              href={`/dashboard/${spaceId}/collection`}
              className="bg-transparent p-0 text-[12.5px] text-fg-muted hover:text-accent"
            >
              Captures →
            </Link>
            <Link
              href={`/dashboard/${spaceId}/comparison`}
              className="bg-transparent p-0 text-[12.5px] text-fg-muted hover:text-accent"
            >
              Comparison →
            </Link>
          </>
        }
      />
      <SubspaceStatusList
        spaceId={spaceId}
        subspaces={subspaces.data ?? []}
        vms={subspaceVMs}
      />

      {/* Two-up */}
      <div
        className="grid gap-4 mobile:grid-cols-1"
        style={{ gridTemplateColumns: "1.4fr 1fr" }}
      >
        <Card className="p-0">
          <CardHeader>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
              Today · {todayCaptures.length} capture
              {todayCaptures.length === 1 ? "" : "s"}
            </span>
            <Spacer />
            <Link
              href={`/dashboard/${spaceId}/collection`}
              className="bg-transparent p-0 text-[12.5px] text-fg-muted hover:text-accent"
            >
              All →
            </Link>
          </CardHeader>
          <TodayTimeline
            spaceId={spaceId}
            captures={todayCaptures}
            subspaces={subspaces.data ?? []}
          />
        </Card>

        <Card className="p-0">
          <CardHeader>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
              Decision readiness
            </span>
            <Spacer />
            <Link
              href={`/dashboard/${spaceId}/decision`}
              className="bg-transparent p-0 text-[12.5px] text-fg-muted hover:text-accent"
            >
              Full tree →
            </Link>
          </CardHeader>

          <div
            className="grid items-center gap-4 px-[18px] py-4 mobile:grid-cols-[64px_1fr]"
            style={{ gridTemplateColumns: "96px 1fr" }}
          >
            <ReadinessRing
              value={readiness}
              size={96}
              thickness={8}
              color="var(--accent)"
              showPercent
              fontSize={22}
            />
            <div className="min-w-0">
              <div className="text-[14px] font-medium leading-[1.4] text-fg">
                {criticalGaps} critical gap{criticalGaps === 1 ? "" : "s"}{" "}
                before you can walk in confidently.
              </div>
              <div className="mt-1 text-[12.5px] leading-[1.55] text-fg-muted">
                {gapHint(gaps.data ?? [])}
              </div>
            </div>
          </div>

          <hr className="m-0 h-px border-0 bg-border" />

          <div className="m-4">
            <ChatCTA
              title={
                <>
                  Ask Misir anything about this challenge.
                </>
              }
              hint="Misir uses your captures + subspace context."
              ctaLabel={
                <>
                  Chat
                  <Icon name="arrow-right" size={12} />
                </>
              }
              onClick={() =>
                openModal({ kind: "new-chat", defaultSpaceId: spaceId })
              }
            />
          </div>
        </Card>
      </div>
    </>
  )
}

function gapHint(gaps: { label: string }[]): string {
  if (gaps.length === 0) return "No outstanding gaps — synthesize what you have."
  return gaps
    .slice(0, 2)
    .map((g) => g.label)
    .join(". ") + "."
}
