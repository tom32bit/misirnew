import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

type DotTone = "accent" | "success" | "warning" | "faint" | "current"

const TONE_CLASS: Record<DotTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  faint: "bg-[var(--fg-faint)]",
  current: "bg-current",
}

/**
 * 6px filled circle. Pass `color` (hex/css value) to override the tone — used
 * for per-space and per-subspace colored dots.
 */
export function Dot({
  tone = "accent",
  color,
  size = 6,
  className,
  style,
}: {
  tone?: DotTone
  color?: string
  size?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block flex-none rounded-full",
        !color && TONE_CLASS[tone],
        className,
      )}
      style={{
        width: size,
        height: size,
        ...(color ? { background: color } : null),
        ...style,
      }}
    />
  )
}

/**
 * 7px circle with the breathing pulse keyframe used on "Misir noticed" labels
 * and critical severity rows.
 */
export function Pulsing({
  tone = "accent",
  color,
  size = 7,
  className,
  style,
}: {
  tone?: DotTone
  color?: string
  size?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block flex-none rounded-full",
        !color && TONE_CLASS[tone],
        "animate-[pulse-dot_1.8s_ease-in-out_infinite]",
        className,
      )}
      style={{
        width: size,
        height: size,
        ...(color ? { background: color } : null),
        ...style,
      }}
    />
  )
}
