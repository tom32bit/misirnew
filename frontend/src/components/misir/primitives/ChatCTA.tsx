"use client"

import type { ReactNode } from "react"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ChatCTA({
  title,
  hint,
  ctaLabel = "Start chat",
  onClick,
  className,
}: {
  title: ReactNode
  hint?: ReactNode
  ctaLabel?: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3.5 rounded-panel border border-dashed border-border-strong bg-bg-subtle px-[18px] py-3.5",
        className,
      )}
    >
      <div className="grid h-8 w-8 flex-none place-items-center rounded-full bg-accent text-fg-on-accent">
        <MessageCircle size={16} />
      </div>
      <div className="min-w-0 flex-1 text-[13.5px] leading-[1.5] text-fg">
        {title}
        {hint ? (
          <small className="mt-0.5 block text-[12px] text-fg-muted">{hint}</small>
        ) : null}
      </div>
      <Button variant="primary" size="sm" onClick={onClick}>
        {ctaLabel}
        <ArrowRight size={12} />
      </Button>
    </div>
  )
}
