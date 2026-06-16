"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/misir/primitives/Icon"
import { Button } from "@/components/misir/primitives/Button"
import { useUIStore } from "@/lib/stores/ui-store"
import { useMisirAnswer } from "@/lib/hooks/useMisirAnswer"
import { questionForSpace } from "@/lib/constants/misir-questions"
import type { Space, Subspace } from "@/lib/api/types"

type ResolvedQuestion = NonNullable<ReturnType<typeof questionForSpace>>

/**
 * Three-state thinking-partner card. Color theming flows from --ma-color
 * (space accent), set inline on the root.
 */
export function MisirAsks({
  space,
  subspaces,
  color,
}: {
  space: Space
  subspaces: Subspace[]
  color: string
}) {
  const router = useRouter()
  const ask = useUIStore((s) => s.asksFor(space.id))
  const toggle = useUIStore((s) => s.toggleAsks)
  const setDraft = useUIStore((s) => s.setAsksDraft)
  const reset = useUIStore((s) => s.resetAsks)
  const dismiss = useUIStore((s) => s.dismissAsks)

  const q = questionForSpace(space, subspaces)
  const submit = useMisirAnswer(space.id, q)

  const submittedTitle = q?.subspace?.name ?? "subspace"

  if (!q || ask.dismissed) return null

  const baseStyle = { ["--ma-color" as string]: color } as React.CSSProperties

  // ── Answering ──────────────────────────────────────────────────────
  if (ask.answering && !ask.response) {
    return (
      <Card style={baseStyle}>
        <Header subspaceName={submittedTitle} prefix="Misir asked" />
        <div className="py-0 pl-[22px] pr-[18px] font-display text-[20px] font-semibold leading-[1.4] tracking-[-0.015em] text-fg [text-wrap:pretty]">
          “{q.question}”
        </div>
        <div className="px-[22px] pt-1 text-[13.5px] italic text-fg-muted">
          “{ask.submitted}”
        </div>
        <div className="flex items-center gap-2.5 px-[22px] py-4 text-[13px] text-fg-muted">
          <TypingDots />
          <span>Misir is thinking…</span>
        </div>
      </Card>
    )
  }

  // ── Responded ──────────────────────────────────────────────────────
  if (ask.response) {
    return (
      <Card style={baseStyle}>
        <Header subspaceName={submittedTitle} prefix="Misir" />
        <div className="flex flex-col gap-4 px-[22px] pt-3.5 pb-3.5">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
              You said
            </span>
            <p className="m-0 rounded-md bg-bg-muted px-3.5 py-2.5 text-[13.5px] italic leading-[1.55] text-fg">
              “{ask.submitted}”
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{ color }}
            >
              Misir
            </span>
            <p className="m-0 text-[14.5px] leading-[1.65] text-fg [text-wrap:pretty]">
              {ask.response}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-[22px] py-3.5">
          <Button
            variant="primary"
            colored
            onClick={() => {
              if (q.subspace) {
                router.push(
                  `/dashboard/${space.id}/collection?sub=${q.subspace.id}`,
                )
              } else {
                router.push(`/dashboard/${space.id}/collection`)
              }
            }}
          >
            File to {q.subspace?.name ?? "subspace"}
            <Icon name="arrow-right" size={12} />
          </Button>
          <Button variant="ghost" onClick={() => reset(space.id)}>
            Ask another
          </Button>
          <Button variant="ghost" onClick={() => dismiss(space.id)}>
            Done
          </Button>
        </div>
      </Card>
    )
  }

  // ── Compact (collapsed default) ────────────────────────────────────
  if (!ask.expanded) {
    return (
      <Card style={baseStyle}>
        <button
          type="button"
          onClick={() => toggle(space.id)}
          className="flex w-full items-center gap-3.5 px-[22px] py-2.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--ma-color)_5%,var(--bg))]"
        >
          <span
            className="flex flex-none items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color }}
          >
            <Icon name="zap" size={11} />
            Misir has a question · {submittedTitle}
          </span>
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-medium leading-[1.4] tracking-[-0.01em] text-fg mobile:overflow-visible mobile:whitespace-normal">
            {q.question}
          </span>
          <Button
            variant="primary"
            colored
            onClick={(e) => {
              e.stopPropagation()
              toggle(space.id)
            }}
          >
            Answer
            <Icon name="arrow-right" size={12} />
          </Button>
          <button
            type="button"
            aria-label="Ask later"
            onClick={(e) => {
              e.stopPropagation()
              dismiss(space.id)
            }}
            className="grid h-6 w-6 flex-none place-items-center rounded-sm text-fg-subtle hover:bg-[var(--bg-hover)] hover:text-fg"
          >
            <Icon name="x" size={13} />
          </button>
        </button>
      </Card>
    )
  }

  // ── Expanded (composing) ───────────────────────────────────────────
  return <ExpandedAsk space={space} color={color} q={q} submit={submit} toggle={toggle} dismiss={dismiss} draft={ask.draft} setDraft={setDraft} />
}

function ExpandedAsk({
  space,
  color,
  q,
  submit,
  toggle,
  dismiss,
  draft,
  setDraft,
}: {
  space: Space
  color: string
  q: ResolvedQuestion
  submit: (answer: string) => Promise<void> | void
  toggle: (id: number) => void
  dismiss: (id: number) => void
  draft: string
  setDraft: (id: number, v: string) => void
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const baseStyle = { ["--ma-color" as string]: color } as React.CSSProperties

  useEffect(() => {
    const id = setTimeout(() => taRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [])

  const submittedTitle = q.subspace?.name ?? "subspace"

  return (
    <Card style={baseStyle}>
      <Header
        subspaceName={submittedTitle}
        prefix="Misir has a question"
        onDismiss={() => dismiss(space.id)}
      />
      <div className="px-[22px] pt-2 text-[12.5px] leading-[1.5] text-fg-muted">
        {q.context}
      </div>
      <div className="py-3 pl-[22px] pr-[18px] font-display text-[20px] font-semibold leading-[1.4] tracking-[-0.015em] text-fg [text-wrap:pretty]">
        {q.question}
      </div>
      <div className="px-[22px]">
        <textarea
          ref={taRef}
          rows={2}
          value={draft}
          placeholder={q.placeholder}
          onChange={(e) => setDraft(space.id, e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              (e.metaKey || e.ctrlKey) &&
              draft.trim().length > 0
            ) {
              e.preventDefault()
              void submit(draft.trim())
            }
          }}
          className="w-full resize-none rounded-md border border-border-strong bg-bg px-3 py-2.5 font-sans text-[14px] leading-[1.5] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-faint focus:border-[var(--ma-color,var(--accent))] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ma-color,var(--accent))_15%,transparent)]"
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-[22px] py-3.5">
        <span className="text-[11.5px] text-fg-subtle">⌘ Enter to send</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => toggle(space.id)}>
            Collapse
          </Button>
          <Button variant="ghost" onClick={() => dismiss(space.id)}>
            Ask later
          </Button>
          <Button
            variant="primary"
            colored
            disabled={draft.trim().length === 0}
            onClick={() => void submit(draft.trim())}
          >
            Answer
            <Icon name="arrow-right" size={12} />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={style}
      className={[
        "relative overflow-hidden rounded-[10px] border bg-[color-mix(in_srgb,var(--ma-color,var(--accent))_4%,var(--bg))]",
        "border-[color-mix(in_srgb,var(--ma-color,var(--accent))_30%,var(--border))]",
        "before:content-[''] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-[var(--ma-color,var(--accent))]",
      ].join(" ")}
    >
      {children}
    </div>
  )
}

function Header({
  subspaceName,
  prefix,
  onDismiss,
}: {
  subspaceName: string
  prefix: string
  onDismiss?: () => void
}) {
  return (
    <div className="flex items-center justify-between px-[22px] pt-3.5">
      <div
        className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--ma-color, var(--accent))" }}
      >
        <Icon name="zap" size={11} />
        {prefix} · {subspaceName}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Ask later"
          onClick={onDismiss}
          className="grid h-6 w-6 place-items-center rounded-sm text-fg-subtle hover:bg-[var(--bg-hover)] hover:text-fg"
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-[5px] w-[5px] rounded-full"
          style={{
            background: "var(--ma-color, var(--accent))",
            animation: "typing-bounce 1.4s infinite ease-in-out both",
            animationDelay: `${(i - 2) * 0.16}s`,
          }}
        />
      ))}
    </span>
  )
}
