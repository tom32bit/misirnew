"use client"

import { useEffect, useRef } from "react"
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
export function SpaceTabNav() {
  const params = useParams<{ scope?: string; view?: string }>()
  const router = useRouter()

  const scope = params?.scope ?? "all"
  const view = params?.view ?? ""

  // Keep the active tab in view when the row scrolls on mobile — set scrollLeft
  // directly (not scrollIntoView, which would also scroll the page vertically).
  const scrollerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const scroller = scrollerRef.current
    const activeEl = scroller?.querySelector<HTMLElement>('[data-active="true"]')
    if (!scroller || !activeEl) return
    const target = activeEl.offsetLeft - (scroller.clientWidth - activeEl.clientWidth) / 2
    scroller.scrollTo({ left: Math.max(0, target) })
  }, [view, scope])

  if (scope === "all") return null

  return (
    // Centered on desktop; on phones the 5-tab track is wider than the screen,
    // so left-align and let it scroll horizontally instead of clipping both ends.
    <div
      ref={scrollerRef}
      className="flex flex-none justify-center overflow-x-auto border-b border-border px-[18px] pb-3.5 mobile:justify-start mobile:px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="inline-flex flex-none gap-[3px] rounded-[12px] border border-border bg-bg-subtle p-[3px]">
        {TABS.map((tab) => {
          const active = view === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              data-active={active}
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
