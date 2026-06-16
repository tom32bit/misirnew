"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import {
  ArrowRight,
  ObBack,
  ObEyebrow,
  ObHint,
  ObPrimary,
  StepWrap,
} from "./StepWrap"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Icon } from "@/components/misir/primitives/Icon"
import type { OnboardingDraft } from "./OnboardingFlow"

const INPUT_CLASS =
  "w-full rounded-lg border border-border-strong bg-bg px-4 py-3.5 text-[16px] leading-[1.5] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-faint focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,108,60,0.14)]"

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

export function StepOutcome({
  draft,
  onPatch,
  onBack,
  onNext,
}: {
  draft: OnboardingDraft
  onPatch: (p: Partial<OnboardingDraft>) => void
  onBack: () => void
  onNext: () => void
}) {
  const goalRef = useRef<HTMLTextAreaElement>(null)
  const [calOpen, setCalOpen] = useState(false)
  const valid = draft.goal.trim().length >= 10 && !!draft.deadline

  useEffect(() => {
    const id = setTimeout(() => goalRef.current?.focus(), 80)
    return () => clearTimeout(id)
  }, [])

  const challenge = draft.challenge.trim()
  const display = challenge.length > 32 ? `${challenge.slice(0, 32)}…` : challenge

  return (
    <StepWrap>
      <ObEyebrow>Define the outcome</ObEyebrow>
      <h1 className="mb-9 font-display text-[42px] font-semibold leading-[1.15] tracking-[-0.03em] text-fg [text-wrap:pretty]">
        {display ? (
          <>
            What does{" "}
            <em className="not-italic text-accent">{display}</em>
            <br />
            look like, done?
          </>
        ) : (
          <>
            What does getting there
            <br />
            look like?
          </>
        )}
      </h1>

      <div className="mb-9 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
            End goal
          </div>
          <textarea
            ref={goalRef}
            rows={3}
            value={draft.goal}
            placeholder="Close $5M Series A by Q3, led by an international fund out of SEA."
            onChange={(e) => onPatch({ goal: e.target.value })}
            className={`${INPUT_CLASS} resize-none`}
          />
          <ObHint>
            Specific beats ambitious. Misir uses this to generate subspaces and markers.
          </ObHint>
        </div>

        <div className="flex flex-col gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
            Deadline
          </div>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`${INPUT_CLASS} flex cursor-pointer items-center justify-between ${!draft.deadline ? "text-fg-faint" : "text-fg"}`}
              >
                <span>
                  {draft.deadline ? format(draft.deadline, "d MMM yyyy") : "Pick a date"}
                </span>
                <Icon name="calendar" size={16} className="shrink-0 text-fg-muted" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={draft.deadline}
                onSelect={(date) => {
                  onPatch({ deadline: date })
                  setCalOpen(false)
                }}
                disabled={(date) => date < TODAY}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-3.5">
        <ObBack onClick={onBack} />
        <ObPrimary disabled={!valid} onClick={onNext}>
          Continue
          <ArrowRight />
        </ObPrimary>
      </div>
    </StepWrap>
  )
}
