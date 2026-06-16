"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  ModalShell,
  ModalHead,
  ModalBody,
  ModalFoot,
  ModalField,
} from "./ModalShell"
import { Button } from "@/components/misir/primitives/Button"
import { Icon } from "@/components/misir/primitives/Icon"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useGenerateSpace } from "@/lib/hooks/useSpaces"
import { useApi } from "@/lib/api/client"
import { deadlinesApi } from "@/lib/api/deadlines"

const INPUT_CLASS =
  "w-full rounded-md border border-border-strong bg-bg px-3 py-2 font-sans text-[13.5px] leading-[1.5] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-faint focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,108,60,0.16)]"

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

export function NewSpaceModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const generate = useGenerateSpace()
  const k = useApi()
  const titleRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState("")
  const [goal, setGoal] = useState("")
  const [deadline, setDeadline] = useState<Date | undefined>(undefined)
  const [calOpen, setCalOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setTitle("")
      setGoal("")
      setDeadline(undefined)
      setCalOpen(false)
      return
    }
    const id = setTimeout(() => titleRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [open])

  const submit = async () => {
    if (!title.trim() || !deadline) return
    try {
      const space = await generate.mutateAsync({
        name: title.trim(),
        intention: goal.trim() || undefined,
      })
      await deadlinesApi.upsert(k, space.id, {
        label: title.trim(),
        due_at: deadline.toISOString(),
        target_pct: 80,
      })
      toast.success(`"${space.name}" is ready`, {
        description: "Subspaces and markers have been generated.",
      })
      onClose()
      router.push(`/dashboard/${space.id}/overview`)
    } catch (err) {
      toast.error("Space creation failed", {
        description: err instanceof Error ? err.message : "Backend didn't respond.",
      })
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="New space">
      <ModalHead
        eyebrow="New space"
        title="Define a challenge."
        sub="Name the challenge. Describe what done looks like. Misir builds the structure."
        onClose={onClose}
      />
      <ModalBody>
        {/* Concept bento */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-bg-subtle p-1.5">
          {/* Space — tall featured cell */}
          <div className="row-span-2 flex flex-col gap-3 rounded-lg border border-border bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))] p-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg))]">
              <Icon name="target" size={18} className="text-accent" />
            </div>
            <div>
              <div className="mb-1 text-[13px] font-semibold text-fg">Space</div>
              <p className="m-0 text-[11.5px] leading-[1.5] text-fg-muted">
                A container for one challenge you&apos;re actively working on. What you&apos;re creating right now.
              </p>
            </div>
          </div>

          {/* Subspaces */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg p-3">
            <div className="flex items-center gap-1.5">
              <Icon name="layers" size={13} className="shrink-0 text-accent" />
              <span className="text-[12px] font-semibold text-fg">Subspaces</span>
            </div>
            <p className="m-0 text-[11px] leading-[1.4] text-fg-muted">
              Focus areas Misir breaks your challenge into automatically.
            </p>
          </div>

          {/* Markers */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg p-3">
            <div className="flex items-center gap-1.5">
              <Icon name="bookmark" size={13} className="shrink-0 text-accent" />
              <span className="text-[12px] font-semibold text-fg">Markers</span>
            </div>
            <p className="m-0 text-[11px] leading-[1.4] text-fg-muted">
              Readiness criteria for the challenge. When enough are met, you&apos;re ready to act.
            </p>
          </div>

          {/* Artifacts — wide bottom cell */}
          <div className="col-span-2 flex items-center gap-3 rounded-lg border border-border bg-bg p-3">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-bg-subtle">
              <Icon name="file-text" size={13} className="text-accent" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-fg">Artifacts</div>
              <p className="m-0 text-[11px] leading-[1.35] text-fg-muted">
                Sources you gather while working the problem — pages, documents, conversations.
              </p>
            </div>
          </div>
        </div>

        <ModalField label="Challenge">
          <input
            ref={titleRef}
            type="text"
            placeholder="Raise Series A, hire a Head of Eng, learn pour-over coffee…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit()
            }}
            className={INPUT_CLASS}
          />
        </ModalField>
        <ModalField
          label="End goal"
          hint="Specific is better than ambitious. Misir's marker generation uses this."
        >
          <textarea
            rows={3}
            placeholder="Close $5M Series A by Q3 2025, led by an international fund out of SEA."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className={`${INPUT_CLASS} resize-none`}
          />
        </ModalField>
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">
            Deadline
          </span>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`${INPUT_CLASS} flex cursor-pointer items-center justify-between ${!deadline ? "text-fg-faint" : ""}`}
              >
                <span>{deadline ? format(deadline, "d MMM yyyy") : "Pick a date"}</span>
                <Icon name="calendar" size={14} className="shrink-0 text-fg-muted" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="z-[202] w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={deadline}
                onSelect={(date) => {
                  setDeadline(date)
                  setCalOpen(false)
                }}
                disabled={(date) => date < TODAY}
              />
            </PopoverContent>
          </Popover>
        </div>
      </ModalBody>
      <ModalFoot
        left="⌘ Enter to create"
        right={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              disabled={!title.trim() || !deadline || generate.isPending}
            >
              {generate.isPending ? "Creating…" : "Create space"}
              <Icon name="arrow-right" size={12} />
            </Button>
          </>
        }
      />
    </ModalShell>
  )
}
