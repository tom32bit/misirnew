"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { motion } from "motion/react"
import { Icon } from "@/components/misir/primitives/Icon"
import { SPRING } from "@/lib/motion"
import { useUnreadCounts } from "@/lib/hooks/useUnreadCounts"

type CountKey = "inboxUnread" | "notifUnread"
type Item = { id: string; icon: string; countKey: CountKey | null }

// The bottom bar is the ONLY primary view-switcher on mobile — SpaceTabNav is
// hidden there. Its tabs follow the current scope so they mirror what desktop
// shows: the global sections under "all", and a space's own tabs inside a
// space (same five as the desktop SpaceTabNav). Scope switching itself lives
// in the hamburger drawer.
const ALL_ITEMS: Item[] = [
  { id: "home", icon: "home", countKey: null },
  { id: "inbox", icon: "inbox", countKey: "inboxUnread" },
  { id: "collection", icon: "library", countKey: null },
  { id: "comparison", icon: "columns-3", countKey: null },
  { id: "decision", icon: "git-branch", countKey: null },
]
const SPACE_ITEMS: Item[] = [
  { id: "overview", icon: "target", countKey: null },
  { id: "collection", icon: "library", countKey: null },
  { id: "comparison", icon: "columns-3", countKey: null },
  { id: "decision", icon: "git-branch", countKey: null },
  { id: "settings", icon: "settings", countKey: null },
]

export function MobileNav() {
  const params = useParams<{ scope?: string; view?: string }>()
  const scope = params?.scope ?? "all"
  const isAll = scope === "all"
  const view = params?.view ?? (isAll ? "home" : "overview")
  const counts = useUnreadCounts()
  const items = isAll ? ALL_ITEMS : SPACE_ITEMS

  return (
    <nav
      aria-label="Navigation"
      className="fixed bottom-0 left-0 right-0 z-[200] hidden min-h-14 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] mobile:flex"
    >
      {items.map((item) => {
        const active = view === item.id
        const count = item.countKey ? counts[item.countKey] : 0
        return (
          <Link
            key={item.id}
            href={`/dashboard/${scope}/${item.id}`}
            className={[
              "relative flex flex-1 items-center justify-center transition-colors",
              active ? "text-accent" : "text-fg-subtle",
            ].join(" ")}
          >
            {/* Same gliding-pill active language as the Sidebar/SpaceTabNav. */}
            <span className="relative grid h-9 w-14 place-items-center rounded-full">
              {active && (
                <motion.span
                  layoutId="mobilenav-active"
                  transition={SPRING.snap}
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-[var(--bg-active)]"
                />
              )}
              <Icon name={item.icon} size={20} className="relative" />
            </span>
            {count > 0 && (
              <span
                className="absolute top-2 grid h-[14px] min-w-[14px] place-items-center rounded-full bg-accent px-1 font-mono text-[9px] font-semibold leading-none text-fg-on-accent"
                style={{ right: "calc(50% - 18px)" }}
              >
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
