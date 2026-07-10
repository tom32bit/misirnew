"use client"

import { useRouter } from "next/navigation"
import { Icon } from "@/components/misir/primitives/Icon"
import { Button } from "@/components/misir/primitives/Button"
import {
  Card,
  CardHeader,
  Spacer,
} from "@/components/misir/primitives/Card"
import { SubspaceTag } from "@/components/misir/primitives/Tag"
import { useSubspaces } from "@/lib/hooks/useSubspaces"
import { getSubspaceColor } from "@/lib/constants/subspace-colors"
import type { Gap } from "@/lib/api/types"

export function KnowledgeGaps({
  spaceId,
  gaps,
}: {
  spaceId: number
  gaps: Gap[]
}) {
  const router = useRouter()
  const subspaces = useSubspaces(spaceId)

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader>
        <span className="font-sans text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
          Fill these gaps before deciding
        </span>
        <Spacer />
        <span className="font-sans text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
          {gaps.length} remaining
        </span>
      </CardHeader>

      {gaps.length === 0 && (
        <div className="px-6 py-8 text-center text-[13px] text-fg-subtle">
          No outstanding gaps for this space.
        </div>
      )}

      {gaps.map((g) => {
        const subspace = g.subspace_id
          ? (subspaces.data ?? []).find((s) => s.id === g.subspace_id)
          : null
        const subspaceColor = subspace ? getSubspaceColor(subspace) : undefined
        const sevTone = sevClass(g.severity)
        return (
          <div
            key={g.id}
            className="grid items-start gap-3.5 border-b border-border px-[18px] py-3.5 last:border-b-0 mobile:grid-cols-[72px_1fr] mobile:gap-2.5"
            style={{ gridTemplateColumns: "110px 1fr auto" }}
          >
            <span
              className={[
                "inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.08em]",
                sevTone,
              ].join(" ")}
            >
              <span className={["block h-[6px] w-[6px] rounded-full", sevDot(g.severity)].join(" ")} />
              {g.severity}
            </span>

            <div className="flex min-w-0 flex-col gap-1">
              <div className="font-serif text-[13.5px] font-medium leading-[1.45] text-fg">
                {g.label}
              </div>
              <div className="font-serif text-[12.5px] leading-[1.5] text-fg-muted">
                {g.action ?? "Open the subspace to investigate."}
              </div>
              {subspace && (
                <div className="mt-2">
                  <SubspaceTag color={subspaceColor}>{subspace.name}</SubspaceTag>
                </div>
              )}
            </div>

            <div className="mobile:hidden">
              <Button
                variant="default"
                onClick={() =>
                  router.push(
                    subspace
                      ? `/dashboard/${spaceId}/collection?sub=${subspace.id}`
                      : `/dashboard/${spaceId}/collection`,
                  )
                }
              >
                Investigate
                <Icon name="arrow-right" size={12} />
              </Button>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

function sevClass(s: Gap["severity"]): string {
  if (s === "Critical") return "text-accent"
  if (s === "High") return "text-warning"
  return "text-fg-muted"
}

function sevDot(s: Gap["severity"]): string {
  if (s === "Critical") return "bg-accent animate-[pulse-dot_1.8s_ease-in-out_infinite]"
  if (s === "High") return "bg-warning"
  return "bg-[var(--fg-faint)]"
}
