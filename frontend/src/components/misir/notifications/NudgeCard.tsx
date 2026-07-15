"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Icon } from "@/components/misir/primitives/Icon"
import { Button } from "@/components/misir/primitives/Button"
import { useDismissNudge } from "@/lib/hooks/useNudges"
import { undoableAction } from "@/lib/undoable"
import { useUIStore } from "@/lib/stores/ui-store"
import type { Nudge, Space } from "@/lib/api/types"
import { getSpaceColor } from "@/lib/constants/space-colors"

/**
 * The orange "Misir noticed" interrupt card shown at the top of the
 * Notifications view (and reused on single-space Home for a moment of
 * intentional friction). Dismiss persists for the session only.
 */
export function NudgeCard({
  nudge,
  space,
}: {
  nudge: Nudge
  space?: Space | null
}) {
  const router = useRouter()
  const dismissed = useUIStore((s) => s.nudgesDismissed)
  const dismissLocal = useUIStore((s) => s.dismissNudge)
  const restoreLocal = useUIStore((s) => s.restoreNudge)
  const dismissRemote = useDismissNudge()

  if (dismissed.has(nudge.id)) return null

  const color = space ? getSpaceColor(space) : "var(--accent)"
  const targetHref = nudge.space_id
    ? `/dashboard/${nudge.space_id}/decision`
    : "/dashboard/all/decision"
  const cta = nudge.cta_label?.trim() || "Open decision tree"

  const handleAct = () => {
    dismissRemote.mutate({ id: nudge.id, status: "acted" })
    router.push(targetHref)
  }

  // Optimistic + undoable: the card hides instantly, the remote dismiss only
  // fires once the toast closes un-undone.
  const handleDismiss = () => {
    dismissLocal(nudge.id)
    undoableAction({
      message: "Nudge dismissed",
      description: nudge.direction,
      onUndo: () => restoreLocal(nudge.id),
      onCommit: () =>
        dismissRemote.mutate(
          { id: nudge.id, status: "dismissed" },
          {
            onError: () => {
              restoreLocal(nudge.id)
              toast.error("Couldn't dismiss", { description: "The nudge was restored." })
            },
          },
        ),
    })
  }

  return (
    <div
      role="region"
      aria-label="Misir noticed"
      className="relative grid items-center gap-[18px] rounded-panel border bg-[color-mix(in_srgb,var(--sc,var(--accent))_4%,var(--bg))] py-3.5 pl-[22px] pr-[18px] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-l-panel before:bg-[var(--sc,var(--accent))] mobile:grid-cols-1"
      style={{
        gridTemplateColumns: "1fr auto",
        ["--sc" as string]: color,
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      <div>
        <div
          className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color }}
        >
          <span
            className="block h-[7px] w-[7px] rounded-full animate-[pulse-dot_1.8s_ease-in-out_infinite]"
            style={{ background: color }}
          />
          Misir noticed{space ? ` · ${space.name}` : ""}
        </div>
        <div className="mt-1 font-serif text-[12.5px] leading-[1.5] text-fg-muted">
          {nudge.scatter}
        </div>
        <div className="mt-1 font-serif text-[14px] font-medium leading-[1.45] text-fg">
          {nudge.direction}
        </div>
        {nudge.consequence && (
          <div
            className="mt-1 font-mono text-[11.5px]"
            style={{ color }}
          >
            {nudge.consequence}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" colored onClick={handleAct}>
          <Icon name="git-branch" size={12} />
          {cta}
        </Button>
        <Button
          variant="ghost"
          aria-label="Dismiss"
          onClick={handleDismiss}
        >
          <Icon name="x" size={14} />
        </Button>
      </div>
    </div>
  )
}
