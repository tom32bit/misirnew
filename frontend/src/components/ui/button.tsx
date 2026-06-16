"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 rounded-md",
    "font-sans font-medium whitespace-nowrap",
    "transition-colors cursor-pointer",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:pointer-events-none disabled:opacity-35",
  ].join(" "),
  {
    variants: {
      variant: {
        // Misir variants
        default:
          "bg-bg text-fg border border-border-strong hover:bg-bg-muted",
        primary:
          "bg-accent text-fg-on-accent border border-accent hover:bg-accent-hover hover:border-accent-hover",
        ghost:
          "bg-transparent text-fg-muted border border-transparent hover:bg-[var(--bg-hover)] hover:text-fg",
        link:
          "bg-transparent text-fg-muted hover:text-accent border-0 p-0 h-auto",
        // Shadcn aliases kept for internal components (Calendar, etc.)
        outline:
          "bg-bg text-fg border border-border-strong hover:bg-bg-muted",
        secondary:
          "bg-bg-subtle text-fg border border-border hover:bg-bg-muted",
        destructive:
          "bg-danger text-white border border-danger hover:bg-danger/90",
      },
      size: {
        sm:         "h-7 px-2.5 text-[12px]",
        md:         "h-7 px-3 text-[12.5px]",
        lg:         "h-9 px-4 text-[13px] gap-2",
        // shadcn aliases kept for Calendar internals
        default:    "h-7 px-3 text-[12.5px]",
        xs:         "h-6 px-2 text-[11px] gap-1",
        icon:       "size-7 p-0",
        "icon-sm":  "size-6 p-0",
        "icon-lg":  "size-9 p-0",
        "icon-xs":  "size-5 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
)

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** When true + variant="primary", inherits --sc/--ma-color from the nearest scope wrapper. */
  colored?: boolean
}

function Button({
  className,
  variant = "default",
  size = "md",
  asChild = false,
  colored = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(
        buttonVariants({ variant, size }),
        colored &&
          variant === "primary" &&
          "!bg-[var(--sc,var(--ma-color,var(--accent)))] !border-[var(--sc,var(--ma-color,var(--accent)))]",
        className,
      )}
      {...props}
    />
  )
}

export { Button }
