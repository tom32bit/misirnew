"use client"

import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Filter bar lives flush inside a Card (no separate padding). Holds a
 * Segmented control + selects + search + count, separated by a bottom border.
 */
export function FilterBar({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border bg-bg-subtle px-4 py-2.5",
        "mobile:flex-nowrap mobile:overflow-x-auto",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export type SegmentOption<T extends string> = {
  value: T
  label: ReactNode
  count?: number | string
  /** Display count in accent color (used for unread / critical) */
  highlight?: boolean
}

/**
 * Compact segmented control. Active segment uses bg-muted + fg-default;
 * inactive uses fg-muted. Counts rendered in mono.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (next: T) => void
  options: SegmentOption<T>[]
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-none overflow-hidden rounded-md border border-border bg-bg",
        className,
      )}
    >
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-[26px] px-2.5 text-[11.5px] transition-colors",
              i > 0 && "border-l border-border",
              active
                ? "bg-bg-muted font-medium text-fg"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {o.label}
            {o.count !== undefined && o.count !== "" && (
              <span
                className={cn(
                  "ml-1 font-sans text-[10px]",
                  o.highlight ? "text-accent" : "text-fg-subtle",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Filter-bar count label, right-aligned via margin-left:auto.
 */
export function FilterCount({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto font-sans text-[11px] text-fg-subtle">
      {children}
    </span>
  )
}
