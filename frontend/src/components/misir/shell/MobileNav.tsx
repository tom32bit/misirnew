"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { motion } from "motion/react"
import { Icon } from "@/components/misir/primitives/Icon"
import { SPRING } from "@/lib/motion"
import { useUnreadCounts } from "@/lib/hooks/useUnreadCounts"

const ITEMS = [
  { id: "home", icon: "home", countKey: null },
  { id: "inbox", icon: "inbox", countKey: "inboxUnread" as const },
  { id: "collection", icon: "library", countKey: null },
  { id: "comparison", icon: "columns-3", countKey: null },
  { id: "decision", icon: "git-branch", countKey: null },
] as const

export function MobileNav() {
  const params = useParams<{ scope?: string; view?: string }>()
  const scope = params?.scope ?? "all"
  const view = params?.view ?? "home"
  const counts = useUnreadCounts()

  return (
    <nav
      aria-label="Navigation"
      className="fixed bottom-0 left-0 right-0 z-[200] hidden min-h-14 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] mobile:flex"
    >
      {ITEMS.map((item) => {
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
