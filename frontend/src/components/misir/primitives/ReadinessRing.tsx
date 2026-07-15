"use client"

import { useEffect } from "react"
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import { cn } from "@/lib/utils"
import { SPRING } from "@/lib/motion"

/**
 * Conic-gradient progress ring used across Home (single + all), Decision,
 * and the space cards. Renders an outer ring + inner circle (the "donut
 * hole") + centered percentage text.
 *
 * The arc sweeps from 0 to its value on mount (and glides when the value
 * changes, e.g. after a refetch); the percentage rolls in sync. Both write
 * through motion values — no React re-renders per frame. Reduced-motion
 * users get the final value immediately.
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
  const reduceMotion = useReducedMotion()
  const deg = useMotionValue(reduceMotion ? pct * 3.6 : 0)

  useEffect(() => {
    if (reduceMotion) {
      deg.set(pct * 3.6)
      return
    }
    const controls = animate(deg, pct * 3.6, SPRING.sweep)
    return () => controls.stop()
  }, [pct, reduceMotion, deg])

  const background = useMotionTemplate`conic-gradient(${color} 0 ${deg}deg, ${trackColor} ${deg}deg 360deg)`
  const shownPct = useTransform(deg, (d) => String(Math.round(d / 3.6)))

  const computedFontSize = fontSize ?? Math.max(10, Math.round(size * 0.22))

  return (
    <motion.div
      className={cn("relative flex-none rounded-full", className)}
      style={{ width: size, height: size, background }}
      role="img"
      aria-label={label ?? `${pct}% readiness`}
    >
      <div
        className="absolute rounded-full"
        style={{ inset: thickness, background: "var(--bg)" }}
      />
      {showPercent && (
        <div
          className="absolute inset-0 grid place-items-center font-display font-semibold tracking-[-0.01em] text-fg"
          style={{ fontSize: computedFontSize }}
        >
          <span>
            <motion.span>{shownPct}</motion.span>%
          </span>
        </div>
      )}
    </motion.div>
  )
}
