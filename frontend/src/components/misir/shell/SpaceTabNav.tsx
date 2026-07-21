"use client"

import { useParams, useRouter } from "next/navigation"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { SPRING } from "@/lib/motion"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "collection", label: "Collection" },
  { id: "comparison", label: "Comparison" },
  { id: "decision", label: "Decision tree" },
  { id: "settings", label: "Settings" },
] as const

// Claude-style segmented control: a sunken track with the active tab as a
// raised chip. The chip is a shared-layout pill (same language as the
// Sidebar's) that glides between tabs; its elevation comes from a hairline
// border + token shadow so it reads correctly in both themes.
//
// Desktop only — on phones this row would be wider than the screen, and its
// tabs are already the space's entries in the bottom nav, so it's hidden there.
export function SpaceTabNav() {
  const params = useParams<{ scope?: string; view?: string }>()
  const router = useRouter()

  const scope = params?.scope ?? "all"
  const view = params?.view ?? ""

  if (scope === "all") return null

  return (
    <div className="flex flex-none justify-center border-b border-border px-[18px] pb-3.5 mobile:hidden">
      <div className="inline-flex gap-[3px] rounded-[12px] border border-border bg-bg-subtle p-[3px]">
        {TABS.map((tab) => {
          const active = view === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => router.push(`/dashboard/${scope}/${tab.id}`)}
              className={cn(
                "relative rounded-[9px] px-3.5 py-[7px] text-[13px] font-medium transition-colors duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
                active ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
              )}
            >
              {active && (
                <motion.span
                  layoutId="spacetab-active"
                  transition={SPRING.snap}
                  aria-hidden
                  className="absolute inset-0 rounded-[9px] border border-border bg-bg shadow-[var(--shadow-sm)]"
                />
              )}
              <span className="relative">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
