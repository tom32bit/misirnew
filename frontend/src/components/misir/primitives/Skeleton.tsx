"use client"

/**
 * Loading placeholder with a directional shimmer sweep (Claude/Linear style),
 * not an opacity pulse. The gradient + keyframes live in globals.css
 * (`.misir-shimmer`), and the global reduced-motion block freezes it for
 * users who prefer reduced motion.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`misir-shimmer rounded-md ${className}`} />
}
