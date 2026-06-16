import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/** Chip / badge variants matching Misir's design tokens. */
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[3px] border px-[7px] py-px font-mono text-[10.5px] leading-tight whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        // Misir Chip variants
        default:  "bg-bg-muted border-border text-fg",
        marker:   "bg-bg-muted border-border text-fg",
        type:     "bg-bg-subtle border-border text-fg-muted lowercase",
        revisit:  "bg-[rgba(255,108,60,0.10)] border-transparent text-accent uppercase font-semibold tracking-[0.06em]",
        // Shadcn aliases kept for backward compat
        secondary:   "bg-bg-subtle border-border text-fg-muted",
        destructive: "bg-danger/10 border-danger/20 text-danger",
        outline:     "border-border text-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(
        badgeVariants({ variant }),
        // marker variant: accent dot prefix via pseudo
        variant === "marker" &&
          "before:content-['·'] before:mr-1 before:font-bold before:text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/**
 * SubspaceTag — neutral pill with a colored 5 px dot prefix.
 * Color drives the dot only; pill background and text stay neutral.
 */
export function SubspaceTag({
  children,
  color,
  className,
}: {
  children: React.ReactNode
  color?: string
  className?: string
}) {
  return (
    <span
      style={color ? ({ ["--sc" as string]: color } as React.CSSProperties) : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-bg-subtle px-2 py-px text-[11px] text-fg-muted",
        "before:block before:h-[5px] before:w-[5px] before:shrink-0 before:rounded-full before:bg-[var(--sc,var(--accent))]",
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * SpaceTag — colored pill (border + tinted bg + dot all derive from --sc).
 * Used in all-spaces Inbox / Collection / Notification rows.
 */
export function SpaceTag({
  children,
  color,
  className,
}: {
  children: React.ReactNode
  color?: string
  className?: string
}) {
  return (
    <span
      style={color ? ({ ["--sc" as string]: color } as React.CSSProperties) : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-px text-[11px]",
        "border border-[color-mix(in_srgb,var(--sc,var(--accent))_30%,transparent)]",
        "bg-[color-mix(in_srgb,var(--sc,var(--accent))_8%,transparent)]",
        "text-[var(--sc,var(--accent))]",
        "before:block before:h-[5px] before:w-[5px] before:shrink-0 before:rounded-full before:bg-[var(--sc,var(--accent))]",
        className,
      )}
    >
      {children}
    </span>
  )
}
