"use client"

import Image from "next/image"

const FILLS = { 1: "33%", 2: "66%", 3: "100%" } as const

export function ObChrome({ step }: { step: 1 | 2 | 3 }) {
  return (
    <>
      {/* Top progress bar */}
      <div className="fixed inset-x-0 top-0 z-10 h-[2px] bg-[var(--border)]">
        <div
          className="h-full rounded-r-[2px] bg-accent"
          style={{
            width: FILLS[step],
            transition: "width 420ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>

      {/* Brand */}
      <div className="fixed left-7 top-5 z-10 flex items-center gap-2.5">
        <Image src="/misir-logo.png" width={22} height={22} alt="Misir" />
        <span className="font-display text-[18px] font-semibold tracking-tight text-fg">
          Misir
        </span>
      </div>

      {/* Step counter */}
      <div className="fixed right-7 top-6 z-10 font-mono text-[11px] tracking-[0.08em] text-fg-subtle">
        {step} / 3
      </div>
    </>
  )
}
