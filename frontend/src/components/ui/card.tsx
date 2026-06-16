import * as React from "react"
import { cn } from "@/lib/utils"

/** Bordered card shell — 8 px radius, bg-bg, no shadow. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("rounded-lg border border-border bg-bg", className)}
      {...props}
    />
  )
}

/**
 * Horizontal toolbar strip with a bottom border.
 * Replaces shadcn's vertical CardHeader — Misir cards have a flex-row header.
 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex items-center gap-2.5 border-b border-border px-[18px] py-3",
        className,
      )}
      {...props}
    />
  )
}

/** Padded body region inside a card. */
function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-body"
      className={cn("p-4 px-[18px]", className)}
      {...props}
    />
  )
}

/** Flex-1 spacer for pushing items to opposite ends of a header row. */
function Spacer() {
  return <span className="flex-1" />
}

/** Section heading row used above lists — title, optional small, optional right slot. */
function SectionHead({
  title,
  small,
  right,
  className,
}: {
  title: React.ReactNode
  small?: React.ReactNode
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 px-0.5 pt-1.5",
        className,
      )}
    >
      <div className="text-[14px] font-medium text-fg">
        {title}
        {small ? (
          <small className="ml-1.5 text-[12px] font-normal text-fg-subtle">
            {small}
          </small>
        ) : null}
      </div>
      {right ? <div className="flex items-center gap-2.5">{right}</div> : null}
    </div>
  )
}

/** Thin 3 px progress bar. Color follows --sc when set, falls back to accent. */
function ProgressBar({
  value,
  color,
  className,
}: {
  value: number
  color?: string
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn(
        "h-[3px] w-full overflow-hidden rounded-[3px] bg-border-strong",
        className,
      )}
    >
      <div
        className="h-full rounded-[inherit]"
        style={{ width: `${pct}%`, background: color ?? "var(--sc, var(--accent))" }}
      />
    </div>
  )
}

// Keep shadcn names around so any direct shadcn imports don't break
const CardTitle = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("font-semibold leading-none text-fg", className)} {...props} />
)
const CardDescription = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("text-[13px] text-fg-muted", className)} {...props} />
)
const CardContent = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("px-[18px]", className)} {...props} />
)
const CardFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("flex items-center px-[18px] pt-3", className)} {...props} />
)
const CardAction = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} {...props} />
)

export {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
  Spacer,
  SectionHead,
  ProgressBar,
}
