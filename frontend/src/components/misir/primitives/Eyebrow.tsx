import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

/**
 * Mono uppercase label used as a section/eyebrow. Color defaults to fg-muted
 * but is intentionally overridable (the design uses accent-color eyebrows on
 * Misir-asks, nudge, and tension cards).
 */
export function Eyebrow({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-muted",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
