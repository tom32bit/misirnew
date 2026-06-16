"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Icon } from "@/components/misir/primitives/Icon"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { useApi } from "@/lib/api/client"
import { chatApi } from "@/lib/api/chat"
import { useQueryClient } from "@tanstack/react-query"

const PROMPTS = [
  "What's the single biggest gap before my next deadline?",
  "Which subspace should I close first?",
  "Draft the opening 90 seconds of the pitch.",
  "What do my captures say about the competitive landscape?",
]

export function NewChatModal({
  open,
  defaultSpaceId,
  onClose,
}: {
  open: boolean
  defaultSpaceId?: number
  onClose: () => void
}) {
  const router = useRouter()
  const qc = useQueryClient()
  const k = useApi()
  const { data: spaces = [] } = useSpaces()
  const ta = useRef<HTMLTextAreaElement>(null)

  const [spaceId, setSpaceId] = useState<number | undefined>(defaultSpaceId)
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setDraft("")
      setSubmitting(false)
      return
    }
    setSpaceId(defaultSpaceId ?? spaces[0]?.id)
    const id = setTimeout(() => ta.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [open, defaultSpaceId, spaces])

  const submit = async () => {
    if (!draft.trim() || !spaceId || submitting) return
    setSubmitting(true)
    try {
      const conv = await chatApi.createConversation(k, { space_id: spaceId })
      qc.invalidateQueries({ queryKey: ["inbox"] })
      onClose()
      router.push(
        `/dashboard/chat/${conv.id}?send=${encodeURIComponent(draft.trim())}`,
      )
    } catch (err) {
      setSubmitting(false)
      toast.error("Chat couldn't start", {
        description: err instanceof Error ? err.message : "Backend didn't respond.",
      })
    }
  }

  const usePrompt = (p: string) => {
    setDraft(p)
    setTimeout(() => {
      const el = ta.current
      if (el) {
        el.focus()
        el.setSelectionRange(p.length, p.length)
      }
    }, 0)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <div className="flex-1">
            <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
              New chat
            </div>
            <DialogTitle>Ask Misir.</DialogTitle>
            <DialogDescription className="mt-1">
              Misir reads your captures and subspaces before answering.
            </DialogDescription>
          </div>
          <DialogCloseButton />
        </DialogHeader>

        <DialogBody>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">
              In space
            </span>
            <div className="flex flex-wrap gap-1.5">
              {spaces.map((s) => {
                const active = spaceId === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSpaceId(s.id)}
                    className={[
                      "inline-flex h-7 items-center gap-1.5 rounded-pill border bg-bg px-3 text-[12.5px] transition-colors cursor-pointer",
                      active
                        ? "border-accent bg-accent text-fg-on-accent"
                        : "border-border-strong text-fg-muted hover:bg-bg-muted hover:text-fg",
                    ].join(" ")}
                  >
                    <Icon name="target" size={12} />
                    {s.name}
                  </button>
                )
              })}
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">
                Your question
              </span>
              <span className="text-[11.5px] text-fg-subtle">⌘ Enter to send</span>
            </div>
            <Textarea
              ref={ta}
              rows={4}
              value={draft}
              placeholder="Ask anything about what you've captured…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit()
              }}
            />
          </label>

          <div className="rounded-md border border-border bg-bg-subtle px-3.5 py-3">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">
              Or start from
            </div>
            <div className="flex flex-col gap-1">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => usePrompt(p)}
                  className="flex cursor-pointer items-center gap-2 rounded-sm bg-transparent px-3 py-2 text-left text-[12.5px] leading-[1.45] text-fg hover:bg-bg-muted before:flex-none before:font-semibold before:text-accent before:content-['→']"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <div className="text-[11.5px] text-fg-subtle">
            {spaceId
              ? `Sending to ${spaces.find((s) => s.id === spaceId)?.name}`
              : "Pick a space first"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submit}
              disabled={!draft.trim() || !spaceId || submitting}
            >
              {submitting ? "Starting…" : "Send"}
              <ArrowRight size={12} />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
