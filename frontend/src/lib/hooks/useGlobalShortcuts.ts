"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/lib/stores/ui-store"
import { useTheme } from "@/lib/hooks/useTheme"

/** g-then-<key> navigation targets (Linear-style sequences). */
const GO: Record<string, string> = {
  h: "/dashboard/all/home",
  i: "/dashboard/all/inbox",
  n: "/dashboard/all/notification",
  c: "/dashboard/all/collection",
  m: "/dashboard/all/comparison",
  d: "/dashboard/all/decision",
}

const SEQUENCE_WINDOW_MS = 800

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

/**
 * Global keyboard layer for the dashboard shell:
 *   ⌘/Ctrl+K  command palette (works even while typing)
 *   g h/i/n/c/m/d  navigate     n  new space     t  theme     ?  help
 * Single-key shortcuts are suppressed while typing or while a modal is open.
 */
export function useGlobalShortcuts() {
  const router = useRouter()
  const modal = useUIStore((s) => s.modal)
  const openModal = useUIStore((s) => s.openModal)
  const closeModal = useUIStore((s) => s.closeModal)
  const [, toggleTheme] = useTheme()

  // Refs so the single document listener always sees current state without
  // re-subscribing on every render. Synced in an effect — writing a ref
  // during render violates the rules of React.
  const modalRef = useRef(modal)
  useEffect(() => {
    modalRef.current = modal
  }, [modal])
  const pendingG = useRef<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — toggle the palette from anywhere, including inputs.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        if (modalRef.current?.kind === "command") closeModal()
        else openModal({ kind: "command" })
        return
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (modalRef.current) return

      const key = e.key.toLowerCase()

      // Second key of a "g …" sequence?
      if (pendingG.current !== null && Date.now() - pendingG.current < SEQUENCE_WINDOW_MS) {
        pendingG.current = null
        const href = GO[key]
        if (href) {
          e.preventDefault()
          router.push(href)
          return
        }
      }

      if (key === "g") {
        pendingG.current = Date.now()
        return
      }
      pendingG.current = null

      if (key === "n") {
        e.preventDefault()
        openModal({ kind: "new-space" })
      } else if (key === "t") {
        e.preventDefault()
        toggleTheme()
      } else if (e.key === "?") {
        e.preventDefault()
        openModal({ kind: "shortcuts" })
      }
    }

    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [router, openModal, closeModal, toggleTheme])
}
