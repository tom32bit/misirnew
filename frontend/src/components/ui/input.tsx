import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-7 w-full rounded-md border border-border bg-bg px-2.5",
        "text-[12.5px] text-fg placeholder:text-fg-faint",
        "outline-none transition-[border-color,box-shadow]",
        "focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,108,60,0.16)]",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
