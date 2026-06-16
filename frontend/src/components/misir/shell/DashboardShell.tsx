"use client"

import { AnimatePresence, motion } from "motion/react"
import type { Space } from "@/lib/api/types"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { SpaceTabNav } from "./SpaceTabNav"
import { MobileNav } from "./MobileNav"
import { ModalRoot } from "@/components/misir/modals/ModalRoot"
import { useUIStore } from "@/lib/stores/ui-store"

export function DashboardShell({
  children,
  initialSpaces,
}: {
  children: React.ReactNode
  initialSpaces: Space[]
}) {
  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen)
  const closeMobileMenu = useUIStore((s) => s.setMobileMenuOpen)

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => closeMobileMenu(false)}
            className="fixed inset-0 z-[299] bg-[rgba(20,18,16,0.5)] backdrop-blur-[1px] md:hidden"
          />
        )}
      </AnimatePresence>

      <Sidebar initialSpaces={initialSpaces} />

      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <Topbar />
        <SpaceTabNav />
        <div className="flex-1 overflow-y-auto px-7 pt-6 pb-16 mobile:px-3 mobile:pt-3 mobile:pb-[72px]">
          <div className="mx-auto flex max-w-view flex-col gap-[18px]">
            {children}
          </div>
        </div>
      </div>

      <MobileNav />
      <ModalRoot />
    </div>
  )
}
