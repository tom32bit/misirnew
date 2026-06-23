"use client"

import Link from "next/link"
import { Icon } from "@/components/misir/primitives/Icon"
import {
  Card,
  CardHeader,
  Spacer,
} from "@/components/misir/primitives/Card"
import { Button } from "@/components/misir/primitives/Button"
import type { DashboardSynthesis } from "@/lib/api/types"

export function SynthesisGrid({
  synthesis,
  readiness,
  onFillGapsHref,
}: {
  synthesis: DashboardSynthesis
  readiness: number | undefined
  onFillGapsHref: string
}) {
  const consensus = synthesis.consensus ?? ""
  const conflict = synthesis.conflict ?? ""
  const blindspot = synthesis.blindspot ?? ""

  if (!consensus && !conflict && !blindspot) return null

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
          Synthesis — what all sources tell you together
        </span>
        <Spacer />
        {readiness != null && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
            Readiness {readiness}%
          </span>
        )}
      </CardHeader>

      <div
        className="grid mobile:grid-cols-1"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
      >
        <SynthesisCol
          icon="check"
          iconColor="var(--success)"
          iconBg="rgba(46,125,85,0.1)"
          label="Where they agree"
          body={consensus || "—"}
          divider
        />
        <SynthesisCol
          icon="alert-triangle"
          iconColor="var(--warning)"
          iconBg="rgba(184,115,13,0.1)"
          label="Where they conflict"
          body={conflict || "—"}
          divider
        />
        <SynthesisCol
          icon="eye-off"
          iconColor="var(--accent)"
          iconBg="rgba(255,108,60,0.1)"
          label="What none covered"
          body={blindspot || "—"}
          tinted
          footer={
            <Link href={onFillGapsHref} className="mt-3 inline-block">
              <Button variant="primary">
                Fill gaps
                <Icon name="arrow-right" size={12} />
              </Button>
            </Link>
          }
        />
      </div>
    </Card>
  )
}

function SynthesisCol({
  icon,
  iconColor,
  iconBg,
  label,
  body,
  divider = false,
  tinted = false,
  footer,
}: {
  icon: string
  iconColor: string
  iconBg: string
  label: string
  body: string
  divider?: boolean
  tinted?: boolean
  footer?: React.ReactNode
}) {
  return (
    <div
      className={[
        "px-[22px] py-5",
        divider ? "border-r border-border mobile:border-r-0 mobile:border-b mobile:border-border" : "",
        tinted ? "bg-[rgba(255,108,60,0.03)] dark:bg-[rgba(255,108,60,0.08)]" : "",
      ].join(" ")}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <div
          className="grid h-[22px] w-[22px] place-items-center rounded-md"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon name={icon} size={13} />
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
          {label}
        </div>
      </div>
      <p className="m-0 font-serif text-[13px] leading-[1.6] text-fg">{body}</p>
      {footer}
    </div>
  )
}
