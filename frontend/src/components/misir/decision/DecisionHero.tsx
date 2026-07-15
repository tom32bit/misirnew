"use client"

import { ReadinessRing } from "@/components/misir/primitives/ReadinessRing"
import { ProgressBar } from "@/components/misir/primitives/Card"
import type { Deadline } from "@/lib/api/types"

type DecisionOption = { label: string; note: string }

function daysUntil(iso: string): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.round((t - Date.now()) / (24 * 3_600_000)))
}

export function DecisionHero({
  question,
  optionA,
  optionB,
  readiness,
  deadline,
}: {
  question: string
  optionA: DecisionOption & { readiness?: number }
  optionB: DecisionOption & { readiness?: number }
  readiness: number
  deadline: Deadline | null | undefined
}) {
  return (
    <div className="rounded-panel border border-[rgba(217,119,87,0.2)] bg-[rgba(217,119,87,0.04)] px-[22px] py-5 dark:border-[rgba(217,119,87,0.22)] dark:bg-[rgba(217,119,87,0.07)]">
      <div className="mb-1.5 font-sans text-[10.5px] uppercase tracking-[0.08em] text-accent">
        Active strategic decision
      </div>
      <div className="mb-3.5 font-display text-[22px] font-medium leading-[1.25] tracking-tight text-fg">
        {question}
      </div>

      <div
        className="mb-[18px] grid items-stretch gap-3.5 mobile:grid-cols-1"
        style={{ gridTemplateColumns: "1fr auto 1fr" }}
      >
        <Option opt={optionA} primary />
        <div className="self-center rounded-full border border-border-strong bg-bg px-2.5 py-1 font-sans text-[11px] font-semibold text-fg-muted mobile:hidden">
          VS
        </div>
        <Option opt={optionB} />
      </div>

      <div className="flex items-center gap-3.5 rounded-md border border-border bg-bg px-4 py-3.5">
        <ReadinessRing
          value={readiness}
          size={48}
          thickness={6}
          color="var(--accent)"
          showPercent
          fontSize={13}
        />
        <div className="flex-1 font-serif text-[13px] leading-[1.55] text-fg-muted">
          <strong className="font-semibold text-fg">
            Source coverage {readiness}%.
          </strong>{" "}
          {deadline ? (
            <>
              You have a {deadline.label} in {daysUntil(deadline.due_at)} days.{" "}
            </>
          ) : null}
          Your captures cover {readiness}% of what you need to walk in confidently.
        </div>
      </div>
    </div>
  )
}

function Option({
  opt,
  primary = false,
}: {
  opt: DecisionOption & { readiness?: number }
  primary?: boolean
}) {
  return (
    <div
      className={[
        "flex flex-col gap-2 rounded-lg border bg-bg px-4 py-4",
        primary
          ? "border-accent shadow-[inset_0_0_0_1px_var(--accent)]"
          : "border-border-strong",
      ].join(" ")}
    >
      <div
        className={[
          "font-display text-[16px] font-semibold tracking-[-0.01em]",
          primary ? "text-fg" : "text-fg-muted",
        ].join(" ")}
      >
        {opt.label}
      </div>
      {/* Per-option readiness renders only when the backend actually provides
          it — an empty bar would read as a (false) "0% readiness" claim. */}
      {opt.readiness != null && (
        <ProgressBar
          value={opt.readiness}
          color={primary ? "var(--accent)" : "var(--fg-faint)"}
        />
      )}
      <div
        className={[
          "inline-flex items-center gap-2 font-sans text-[11px]",
          primary ? "text-accent" : "text-fg-muted",
        ].join(" ")}
      >
        {opt.readiness != null && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
        {opt.readiness != null ? `${opt.readiness}% readiness · ` : ""}
        {opt.note}
      </div>
    </div>
  )
}
