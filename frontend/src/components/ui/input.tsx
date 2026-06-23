import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-[45px] w-full rounded-md",
        "border border-[var(--border-strong)] bg-bg",
        "px-3 text-[13px] text-fg placeholder:text-fg-faint",
        "outline-none transition-[border-color,box-shadow] duration-[120ms]",
        "focus:border-[#61AAF2] focus:shadow-[0_0_0_2px_rgba(97,170,242,0.25)]",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
