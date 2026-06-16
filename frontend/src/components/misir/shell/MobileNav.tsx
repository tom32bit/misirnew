"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Icon } from "@/components/misir/primitives/Icon"
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
      className="fixed bottom-0 left-0 right-0 z-[200] hidden h-[56px] border-t border-border bg-bg mobile:flex"
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
            <Icon name={item.icon} size={20} />
            {count > 0 && (
              <span
                className="absolute top-2 grid h-[14px] min-w-[14px] place-items-center rounded-full bg-accent px-1 font-mono text-[9px] font-semibold leading-none text-white"
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
