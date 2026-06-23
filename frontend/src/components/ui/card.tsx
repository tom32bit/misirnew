import * as React from "react"
import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("rounded-lg border border-[var(--border)] bg-bg", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex items-center gap-2.5 border-b border-[var(--border)] px-[18px] py-3",
        className,
      )}
      {...props}
    />
  )
}

function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-body" className={cn("p-4 px-[18px]", className)} {...props} />
  )
}

function Spacer() {
  return <span className="flex-1" />
}

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
    <div className={cn("flex items-baseline justify-between gap-3 px-0.5 pt-1.5", className)}>
      <div className="text-[14px] font-medium text-fg">
        {title}
        {small ? (
          <small className="ml-1.5 text-[12px] font-normal text-fg-subtle">{small}</small>
        ) : null}
      </div>
      {right ? <div className="flex items-center gap-2.5">{right}</div> : null}
    </div>
  )
}

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
      className={cn("h-[3px] w-full overflow-hidden rounded-[3px] bg-[var(--border-strong)]", className)}
    >
      <div
        className="h-full rounded-[inherit] transition-[width] duration-300"
        style={{ width: `${pct}%`, background: color ?? "var(--sc, var(--color-accent))" }}
      />
    </div>
  )
}

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
  Card, CardHeader, CardBody,
  CardTitle, CardDescription, CardContent, CardFooter, CardAction,
  Spacer, SectionHead, ProgressBar,
}
