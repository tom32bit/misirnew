"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { Icon } from "@/components/misir/primitives/Icon"
import { DUR, SPRING } from "@/lib/motion"

/**
 * Modal primitive — scrim + centered card with motion animations.
 * On mobile (<768px) the card slides up from the bottom as a sheet via
 * `misir-modal-card[data-variant="sheet"]` styles in globals.css.
 *
 * Esc closes. Scrim click closes. Body scroll locks while open.
 */
export function ModalShell({
  open,
  onClose,
  children,
  ariaLabel = "Dialog",
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  ariaLabel?: string
}) {
  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      // Let Radix handle ESC if a popover/dropdown is open
      if (document.querySelector('[data-state="open"]')) return
      onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (!open || typeof document === "undefined") return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-[rgba(20,18,16,0.45)] backdrop-blur-[2px]"
          />
          <div
            className="fixed inset-0 z-[201] grid place-items-center p-6 pointer-events-none mobile:place-items-end mobile:p-0"
            onClick={onClose}
          >
            <motion.div
              key="card"
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: 8,
                scale: 0.98,
                transition: { duration: DUR.fast },
              }}
              transition={SPRING.smooth}
              data-variant="sheet"
              className="misir-modal-card pointer-events-auto flex max-h-[calc(100vh-48px)] w-[560px] max-w-full flex-col overflow-hidden rounded-xl border border-border-strong bg-bg shadow-pop"
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function ModalHead({
  eyebrow,
  title,
  sub,
  onClose,
}: {
  eyebrow: string
  title: string
  sub?: string
  onClose: () => void
}) {
  return (
    <div className="flex items-start gap-3.5 border-b border-border px-6 pb-4 pt-5">
      <div>
        <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
          {eyebrow}
        </div>
        <h2 className="m-0 mb-1 font-display text-[22px] font-semibold tracking-tight text-fg">
          {title}
        </h2>
        {sub && (
          <p className="m-0 max-w-[420px] text-[13px] leading-[1.5] text-fg-muted">
            {sub}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="ml-auto grid h-7 w-7 place-items-center rounded-sm text-fg-muted hover:bg-bg-muted hover:text-fg"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

export function ModalBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">{children}</div>
  )
}

export function ModalFoot({
  left,
  right,
}: {
  left?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border bg-bg-subtle px-6 py-3.5">
      <div className="text-[11.5px] text-fg-subtle">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  )
}

export function ModalField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[11.5px] leading-[1.4] text-fg-subtle">{hint}</span>
      )}
    </label>
  )
}
