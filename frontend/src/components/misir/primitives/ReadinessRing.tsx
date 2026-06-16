import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

/**
 * Pure-CSS conic-gradient progress ring used across Home (single + all),
 * Decision, and the space cards. Renders an outer ring + inner circle (the
 * "donut hole") + centered percentage text.
 *
 * The design uses three sizes:
 *   - 96px: Home-single mini readiness, Decision hero compact
 *   - 56px: space cards in Decision-all + Home-all sidebar grid
 *   - 48px: Decision-hero stat block
 *   - 36px: All-spaces hero ring
 */
export function ReadinessRing({
  value,
  size = 96,
  thickness = 8,
  color = "var(--accent)",
  trackColor = "var(--border-strong)",
  label,
  showPercent = true,
  fontSize,
  className,
}: {
  value: number
  size?: number
  thickness?: number
  color?: string
  trackColor?: string
  label?: string
  showPercent?: boolean
  fontSize?: number
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const deg = pct * 3.6
  const computedFontSize =
    fontSize ?? Math.max(10, Math.round(size * 0.22))

  const style: CSSProperties = {
    width: size,
    height: size,
    background: `conic-gradient(${color} 0 ${deg}deg, ${trackColor} ${deg}deg 360deg)`,
  }
  const innerStyle: CSSProperties = {
    inset: thickness,
    background: "var(--bg)",
  }

  return (
    <div
      className={cn("relative flex-none rounded-full", className)}
      style={style}
      role="img"
      aria-label={label ?? `${pct}% readiness`}
    >
      <div className="absolute rounded-full" style={innerStyle} />
      {showPercent && (
        <div
          className="absolute inset-0 grid place-items-center font-display font-semibold tracking-[-0.01em] text-fg"
          style={{ fontSize: computedFontSize }}
        >
          {pct}%
        </div>
      )}
    </div>
  )
}
