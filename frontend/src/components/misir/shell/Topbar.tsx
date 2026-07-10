"use client"

import { useParams } from "next/navigation"
import { Icon } from "@/components/misir/primitives/Icon"
import { useUIStore } from "@/lib/stores/ui-store"
import { useSpaces } from "@/lib/hooks/useSpaces"

const VIEW_LABELS: Record<string, string> = {
  home: "Home",
  overview: "Overview",
  inbox: "Inbox",
  notification: "Notification",
  collection: "Collection",
  comparison: "Comparison",
  decision: "Decision tree",
  settings: "Settings",
}

// NOTE: the Today/This week/This month scrubber and calendar day-picker were
// removed for the MVP. The period now defaults to "month" (see usePeriodParams).
// To restore, add the scrubber back here and wire it to ?period / ?date.
export function Topbar() {
  const params = useParams<{ scope?: string; view?: string }>()
  const toggleMobile = useUIStore((s) => s.toggleMobileMenu)
  const { data: spaces = [] } = useSpaces()

  const scope = params?.scope ?? "all"
  const view = params?.view ?? "home"
  const viewLabel = VIEW_LABELS[view] ?? "Home"

  const isAll = scope === "all"
  const activeSpace = isAll
    ? null
    : spaces.find((s) => String(s.id) === scope) ?? null

  const menuBtn = (
    <button
      type="button"
      aria-label="Open menu"
      onClick={toggleMobile}
      className="absolute left-2.5 hidden h-8 w-8 place-items-center rounded-md text-fg-muted hover:bg-[var(--bg-hover)] hover:text-fg mobile:grid"
    >
      <Icon name="menu" size={16} />
    </button>
  )

  // Space scope: the space name as a distinct-but-quiet title, centered above
  // the segmented nav (SpaceTabNav carries the divider). Tinted with the space's
  // own accent so it reads as *this* space without a loud badge.
  if (!isAll) {
    return (
      <div className="relative flex h-[52px] flex-none items-center justify-center px-[18px] mobile:h-12">
        {menuBtn}
        <span className="font-display text-[16px] font-medium leading-none tracking-[-0.01em] text-[var(--color-accent)]">
          {activeSpace?.name ?? "Space"}
        </span>
      </div>
    )
  }

  // Global views: plain view label, left-aligned, with the divider.
  return (
    <div className="relative flex h-[52px] flex-none items-center gap-4 border-b border-border px-[18px] mobile:h-12 mobile:justify-center mobile:px-2.5">
      {menuBtn}
      <span className="text-[13px] font-medium text-fg mobile:text-center">{viewLabel}</span>
    </div>
  )
}
