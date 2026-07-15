"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
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
import { useSpace, useUpdateSpace } from "@/lib/hooks/useSpaces"
import { useDeadline } from "@/lib/hooks/useDeadline"
import { useApi } from "@/lib/api/client"
import { deadlinesApi } from "@/lib/api/deadlines"

const INPUT_CLASS =
  "w-full rounded-md border border-border-strong bg-bg px-3 py-2 font-sans text-[13.5px] leading-[1.5] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-faint focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]"

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

export function EditSpaceModal({
  open,
  spaceId,
  onClose,
}: {
  open: boolean
  spaceId: number | undefined
  onClose: () => void
}) {
  const k = useApi()
  const qc = useQueryClient()
  const titleRef = useRef<HTMLInputElement>(null)

  const space = useSpace(open ? spaceId : undefined)
  const deadline = useDeadline(open ? spaceId : undefined)
  const updateSpace = useUpdateSpace()

  const [name, setName] = useState("")
  const [goal, setGoal] = useState("")
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(undefined)
  const [calOpen, setCalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setName("")
      setGoal("")
      setDeadlineDate(undefined)
      setCalOpen(false)
      return
    }
    if (space.data) {
      setName(space.data.name ?? "")
      setGoal(space.data.goal ?? "")
    }
  }, [open, space.data])

  useEffect(() => {
    if (!open) return
    if (deadline.data?.due_at) {
      setDeadlineDate(new Date(deadline.data.due_at))
    }
  }, [open, deadline.data])

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => titleRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [open])

  const submit = async () => {
    if (!spaceId || !name.trim()) return
    setSaving(true)
    try {
      await updateSpace.mutateAsync({ id: spaceId, body: { name: name.trim(), goal: goal.trim() || undefined } })
      if (deadlineDate) {
        await deadlinesApi.upsert(k, spaceId, {
          label: name.trim(),
          due_at: deadlineDate.toISOString(),
          target_pct: 80,
        })
        qc.invalidateQueries({ queryKey: ["deadline", spaceId] })
      }
      toast.success("Space updated")
      onClose()
    } catch (err) {
      toast.error("Update failed", {
        description: err instanceof Error ? err.message : "Backend didn't respond.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Edit space">
      <ModalHead
        eyebrow="Edit space"
        title="Update this challenge."
        sub="Changes to the name and goal take effect immediately."
        onClose={onClose}
      />
      <ModalBody>
        <ModalField label="Challenge name">
          <input
            ref={titleRef}
            type="text"
            placeholder="Raise Series A…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit()
            }}
            className={INPUT_CLASS}
          />
        </ModalField>
        <ModalField
          label="End goal"
          hint="What does success look like? Misir uses this for context."
        >
          <textarea
            rows={3}
            placeholder="Close $5M Series A by Q3 2025…"
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
                className={`${INPUT_CLASS} flex cursor-pointer items-center justify-between ${!deadlineDate ? "text-fg-faint" : ""}`}
              >
                <span>{deadlineDate ? format(deadlineDate, "d MMM yyyy") : "No deadline set"}</span>
                <Icon name="calendar" size={14} className="shrink-0 text-fg-muted" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="z-[202] w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={deadlineDate}
                onSelect={(date) => {
                  setDeadlineDate(date)
                  setCalOpen(false)
                }}
                disabled={(date) => date < TODAY}
              />
            </PopoverContent>
          </Popover>
        </div>
      </ModalBody>
      <ModalFoot
        left="⌘ Enter to save"
        right={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              disabled={!name.trim() || saving}
            >
              {saving ? "Saving…" : "Save changes"}
              <Icon name="check" size={12} />
            </Button>
          </>
        }
      />
    </ModalShell>
  )
}
