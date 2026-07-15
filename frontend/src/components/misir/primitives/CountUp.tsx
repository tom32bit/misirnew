"use client"

import { useEffect } from "react"
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import { SPRING } from "@/lib/motion"

/**
 * A number that rolls up from 0 on mount and glides to new values on change
 * (e.g. a refetch). Writes through a motion value — no re-render per frame.
 * Reduced-motion users see the final value immediately. Pair with
 * `tabular-nums` on the parent so digits don't jitter.
 */
export function CountUp({
  value,
  suffix = "",
  className,
}: {
  value: number
  suffix?: string
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const mv = useMotionValue(reduceMotion ? value : 0)

  useEffect(() => {
    if (reduceMotion) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, SPRING.sweep)
    return () => controls.stop()
  }, [value, reduceMotion, mv])

  const text = useTransform(mv, (v) => `${Math.round(v)}${suffix}`)

  return <motion.span className={className}>{text}</motion.span>
}
