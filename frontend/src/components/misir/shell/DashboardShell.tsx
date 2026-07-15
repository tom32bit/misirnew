"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { DUR, SPRING } from "@/lib/motion"
import type { Space } from "@/lib/api/types"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { SpaceTabNav } from "./SpaceTabNav"
import { MobileNav } from "./MobileNav"
import { ModalRoot } from "@/components/misir/modals/ModalRoot"
import { useUIStore } from "@/lib/stores/ui-store"
import { useGlobalShortcuts } from "@/lib/hooks/useGlobalShortcuts"

export function DashboardShell({
  children,
  initialSpaces,
}: {
  children: React.ReactNode
  initialSpaces: Space[]
}) {
  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen)
  const closeMobileMenu = useUIStore((s) => s.setMobileMenuOpen)

  // ⌘K palette + g-navigation + n/t/? — active across the whole dashboard.
  useGlobalShortcuts()

  // The dashboard scrolls inside this container (not the window), so Next's
  // built-in scroll-to-top on navigation never fires — reset it ourselves.
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast }}
            onClick={() => closeMobileMenu(false)}
            className="fixed inset-0 z-[299] bg-[rgba(20,18,16,0.5)] backdrop-blur-[1px] md:hidden"
          />
        )}
      </AnimatePresence>

      <Sidebar initialSpaces={initialSpaces} />

      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <Topbar />
        <SpaceTabNav />
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-7 pt-6 pb-16 mobile:px-3 mobile:pt-3 mobile:pb-[72px]"
        >
          {/* Keyed on pathname so each view enters with a soft fade-rise.
              Search-param changes (period, date) deliberately don't re-key. */}
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.smooth}
            className="mx-auto flex max-w-view flex-col gap-[18px]"
          >
            {children}
          </motion.div>
        </div>
      </div>

      <MobileNav />
      <ModalRoot />
    </div>
  )
}
