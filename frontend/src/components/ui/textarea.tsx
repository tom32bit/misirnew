import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full rounded-md resize-none",
        "border border-[var(--border-strong)] bg-bg",
        "px-3 py-2.5 font-sans text-[13px] leading-[1.55] text-fg placeholder:text-fg-faint",
        "outline-none transition-[border-color,box-shadow] duration-[120ms]",
        "focus:border-[var(--color-ring)] focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-ring)_25%,transparent)]",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
