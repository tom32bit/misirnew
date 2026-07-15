"use client"

import { useEffect, useRef } from "react"
import {
  ArrowRight,
  ObEyebrow,
  ObHint,
  ObPrimary,
  ObQuestion,
  StepWrap,
} from "./StepWrap"
import { Icon } from "@/components/misir/primitives/Icon"
import type { OnboardingDraft } from "./OnboardingFlow"


export function StepChallenge({
  draft,
  onPatch,
  onNext,
}: {
  draft: OnboardingDraft
  onPatch: (p: Partial<OnboardingDraft>) => void
  onNext: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const valid = draft.challenge.trim().length >= 3

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(id)
  }, [])

  return (
    <StepWrap>
      <ObEyebrow>New space</ObEyebrow>
      <ObQuestion>
        What decision are you
        <br />
        building toward?
      </ObQuestion>

      <div className="mb-9 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft.challenge}
            autoComplete="off"
            placeholder="Raise Series A, hire a VP Engineering, enter a new market…"
            onChange={(e) => onPatch({ challenge: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) {
                e.preventDefault()
                onNext()
              }
            }}
            className="w-full rounded-lg border border-border-strong bg-bg px-4 py-3.5 text-[16px] leading-[1.5] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-faint focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]"
          />
          <ObHint>
            This becomes your first <strong className="font-medium text-fg">space</strong>. Name it like a challenge you&apos;re actively working on.
          </ObHint>
        </div>

        {/* Concept bento */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-bg-subtle p-1.5">

          {/* Space — featured tall cell */}
          <div className="row-span-2 flex flex-col gap-4 rounded-lg border border-border bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg))] p-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg))]">
              <Icon name="target" size={20} className="text-accent" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[13.5px] font-semibold text-fg">Space</div>
              <p className="m-0 text-[12px] leading-[1.55] text-fg-muted">
                A container for one challenge you&apos;re actively working on. What you&apos;re naming right now.
              </p>
            </div>
          </div>

          {/* Subspaces */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3.5">
            <div className="flex items-center gap-1.5">
              <Icon name="layers" size={14} className="shrink-0 text-accent" />
              <span className="text-[12.5px] font-semibold text-fg">Subspaces</span>
            </div>
            <p className="m-0 text-[11.5px] leading-[1.5] text-fg-muted">
              Focus areas Misir breaks your challenge into automatically.
            </p>
          </div>

          {/* Markers */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3.5">
            <div className="flex items-center gap-1.5">
              <Icon name="bookmark" size={14} className="shrink-0 text-accent" />
              <span className="text-[12.5px] font-semibold text-fg">Markers</span>
            </div>
            <p className="m-0 text-[11.5px] leading-[1.5] text-fg-muted">
              Readiness criteria. When enough are met, you&apos;re ready to act.
            </p>
          </div>

          {/* Artifacts — wide bottom */}
          <div className="col-span-2 flex items-center gap-3.5 rounded-lg border border-border bg-bg p-3.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-bg-subtle">
              <Icon name="file-text" size={14} className="text-accent" />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold text-fg">Artifacts</div>
              <p className="m-0 text-[11.5px] leading-[1.45] text-fg-muted">
                Sources you gather while working the problem — pages, documents, conversations.
              </p>
            </div>
          </div>

        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-3.5">
        <ObPrimary disabled={!valid} onClick={onNext}>
          Continue
          <ArrowRight />
        </ObPrimary>
      </div>
    </StepWrap>
  )
}
