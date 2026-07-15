"use client"

import * as Icons from "lucide-react"
import type { LucideProps } from "lucide-react"

/**
 * Wrapper around lucide-react that accepts the kebab-case names the design
 * spec uses (e.g. "home", "chevron-down", "alert-circle") and converts them
 * to lucide's PascalCase exports at lookup time.
 *
 * Next 16's optimizePackageImports keeps this from inflating the bundle.
 */

function toPascal(name: string): string {
  return name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("")
}

export function Icon({
  name,
  size = 14,
  className,
  ...rest
}: { name: string; size?: number } & Omit<LucideProps, "size">) {
  const key = toPascal(name) as keyof typeof Icons
  const Cmp = Icons[key] as React.ComponentType<LucideProps> | undefined
  if (!Cmp) {
    if (process.env.NODE_ENV !== "production") {
       
      console.warn(`[Icon] unknown lucide icon: ${name}`)
    }
    return null
  }
  return (
    <Cmp
      size={size}
      strokeWidth={1.75}
      className={className}
      aria-hidden
      {...rest}
    />
  )
}
