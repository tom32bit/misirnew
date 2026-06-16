"use client"

import { motion } from "motion/react"
import type { ReactNode } from "react"

export function StepWrap({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{
        duration: 0.32,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="flex w-full max-w-[580px] flex-col"
    >
      {children}
    </motion.div>
  )
}

export function ObEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-[22px] flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
      <span className="block h-1.5 w-1.5 rounded-full bg-accent animate-[pulse-dot_2s_ease-in-out_infinite]" />
      {children}
    </div>
  )
}

export function ObQuestion({ children }: { children: ReactNode }) {
  return (
    <h1 className="mb-9 font-display text-[42px] font-semibold leading-[1.15] tracking-[-0.03em] text-fg [text-wrap:pretty]">
      {children}
    </h1>
  )
}

export function ObHint({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 text-[12px] leading-[1.5] text-fg-subtle">
      {children}
    </div>
  )
}

export function ObPrimary({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: "button" | "submit"
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-[42px] items-center gap-2 rounded-lg border border-accent bg-accent px-[22px] text-[14px] font-medium text-fg-on-accent transition-colors",
        "hover:enabled:bg-accent-hover hover:enabled:border-accent-hover",
        "disabled:pointer-events-none disabled:opacity-35",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

export function ObGhost({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[42px] items-center gap-2 rounded-lg border border-border-strong bg-transparent px-[22px] text-[14px] font-medium text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
    >
      {children}
    </button>
  )
}

export function ObBack({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 bg-transparent p-0 text-[13px] text-fg-subtle hover:text-fg"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  )
}

export function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}
