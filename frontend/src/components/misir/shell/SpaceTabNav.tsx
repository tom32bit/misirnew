"use client"

import { useParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "collection", label: "Collection" },
  { id: "comparison", label: "Comparison" },
  { id: "decision", label: "Decision tree" },
  { id: "settings", label: "Settings" },
] as const

// Claude-style segmented control: a sunken track with the active tab as a
// raised, softly-shadowed chip (replaces the underline-tab pattern).
export function SpaceTabNav() {
  const params = useParams<{ scope?: string; view?: string }>()
  const router = useRouter()

  const scope = params?.scope ?? "all"
  const view = params?.view ?? ""

  if (scope === "all") return null

  return (
    <div className="flex flex-none justify-center border-b border-border px-[18px] pb-3.5">
      <div className="inline-flex gap-[3px] rounded-[12px] border border-border bg-bg-subtle p-[3px]">
        {TABS.map((tab) => {
          const active = view === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => router.push(`/dashboard/${scope}/${tab.id}`)}
              className={cn(
                "rounded-[9px] px-3.5 py-[7px] text-[13px] font-medium transition-colors duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
                active
                  ? "bg-bg-muted text-fg shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]"
                  : "text-fg-subtle hover:text-fg-muted",
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
