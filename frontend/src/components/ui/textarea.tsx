import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full rounded-md border border-border-strong bg-bg px-3 py-2",
        "font-sans text-[13.5px] leading-[1.5] text-fg placeholder:text-fg-faint",
        "outline-none resize-none transition-[border-color,box-shadow]",
        "focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,108,60,0.16)]",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
