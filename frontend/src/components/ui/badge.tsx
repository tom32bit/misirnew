import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[3px] border px-[7px] py-px font-mono text-[10.5px] leading-tight whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-bg-muted border-[var(--border)] text-fg",
        marker:      "bg-bg-muted border-[var(--border)] text-fg",
        type:        "bg-bg-subtle border-[var(--border)] text-fg-muted lowercase",
        revisit:     "bg-[rgba(217,119,87,0.12)] border-transparent text-accent uppercase font-semibold tracking-[0.06em]",
        blue:        "bg-[rgba(32,127,222,0.12)] border-transparent text-[#207FDE]",
        purple:      "bg-[rgba(155,135,245,0.12)] border-transparent text-[#9B87F5]",
        secondary:   "bg-bg-subtle border-[var(--border)] text-fg-muted",
        destructive: "bg-[rgba(191,77,67,0.12)] border-transparent text-danger",
        outline:     "border-[var(--border)] text-fg",
      },
    },
    defaultVariants: { variant: "default" },
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
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {children}
    </span>
  )
}

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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full",
        "border border-[var(--border)] bg-bg-subtle px-2 py-px text-[11px] text-fg-muted",
        "before:block before:h-[5px] before:w-[5px] before:shrink-0 before:rounded-full before:bg-[var(--sc,var(--color-accent))]",
        className,
      )}
    >
      {children}
    </span>
  )
}

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
        "border border-[color-mix(in_srgb,var(--sc,var(--color-accent))_30%,transparent)]",
        "bg-[color-mix(in_srgb,var(--sc,var(--color-accent))_8%,transparent)]",
        "text-[var(--sc,var(--color-accent))]",
        "before:block before:h-[5px] before:w-[5px] before:shrink-0 before:rounded-full before:bg-[var(--sc,var(--color-accent))]",
        className,
      )}
    >
      {children}
    </span>
  )
}
