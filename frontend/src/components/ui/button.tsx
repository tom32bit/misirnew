"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 rounded-md",
    "font-sans font-medium whitespace-nowrap select-none",
    "transition-colors cursor-pointer",
    "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-ring)]",
    "disabled:pointer-events-none disabled:opacity-35",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-bg text-fg border border-[var(--border-strong)] hover:bg-bg-muted",
        primary:
          "bg-accent text-fg-on-accent border border-accent hover:bg-accent-hover active:bg-[var(--color-accent-press)]",
        clay:
          "bg-[var(--color-clay-fill)] text-[#F0F0EB] border border-[var(--color-clay-border)] shadow-[var(--shadow-clay)] hover:brightness-110 active:brightness-90",
        ghost:
          "bg-transparent text-fg-muted border border-transparent hover:bg-[var(--bg-hover)] hover:text-fg",
        link:
          "bg-transparent text-fg-muted border-0 p-0 h-auto hover:text-accent underline-offset-2 hover:underline",
        destructive:
          "bg-danger text-fg-on-accent border border-danger hover:brightness-110",
        outline:
          "bg-bg text-fg border border-[var(--border-strong)] hover:bg-bg-muted",
        secondary:
          "bg-bg-subtle text-fg border border-[var(--border)] hover:bg-bg-muted",
      },
      size: {
        xs:        "h-6  px-2    text-[11px] gap-1",
        sm:        "h-7  px-2.5  text-[12px]",
        md:        "h-7  px-3    text-[12.5px]",
        default:   "h-7  px-3    text-[12.5px]",
        lg:        "h-9  px-4    text-[13px] gap-2",
        icon:      "size-7 p-0",
        "icon-xs": "size-5 p-0",
        "icon-sm": "size-6 p-0",
        "icon-lg": "size-9 p-0",
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
          "!bg-[var(--sc,var(--ma-color,var(--color-accent)))] !border-[var(--sc,var(--ma-color,var(--color-accent)))]",
        className,
      )}
      {...props}
    />
  )
}

export { Button }
