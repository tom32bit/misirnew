"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"
import Markdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/misir/primitives/Skeleton"
import { useMessages, useSendMessageStream } from "@/lib/hooks/useChat"
import { useMarkConversationRead } from "@/lib/hooks/useInbox"
import type { ChatMessage } from "@/lib/api/types"

export function ChatThread({ conversationId }: { conversationId: number }) {
  const router = useRouter()
  const search = useSearchParams()
  const messages = useMessages(conversationId)
  const stream = useSendMessageStream(conversationId)
  const markRead = useMarkConversationRead()

  // Opening the thread (and finishing each reply) marks it read, clearing the
  // inbox unread badge. Guarded so a mid-stream render doesn't fire early.
  const markReadFn = markRead.mutate
  useEffect(() => {
    if (!stream.isStreaming) markReadFn(conversationId)
    // markReadFn identity is stable across renders (react-query mutate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, stream.isStreaming])

  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sentInitial = useRef(false)
  // The last message handed to the stream — kept so a failed send can be
  // retried or restored into the composer instead of being lost. State (not a
  // ref): it's read during render for the error actions.
  const [lastSent, setLastSent] = useState("")

  useEffect(() => {
    if (sentInitial.current) return
    const initial = search.get("send")
    if (initial && messages.isFetched && (messages.data?.length ?? 0) === 0) {
      sentInitial.current = true
      setLastSent(initial)
      void stream.send(initial)
      router.replace(`/dashboard/chat/${conversationId}`)
    }
  }, [search, messages.isFetched, messages.data, stream, conversationId, router])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.data, stream.partial, stream.isStreaming])

  // Auto-grow textarea up to 200px
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [draft])

  const submit = () => {
    if (!draft.trim() || stream.isStreaming) return
    const content = draft.trim()
    setLastSent(content)
    setDraft("")
    void stream.send(content)
  }

  const retry = () => {
    if (!lastSent || stream.isStreaming) return
    void stream.send(lastSent)
  }

  const restoreDraft = () => {
    if (!lastSent) return
    setDraft(lastSent)
    textareaRef.current?.focus()
  }

  const isEmpty =
    !messages.isLoading &&
    (messages.data?.length ?? 0) === 0 &&
    !stream.isStreaming

  return (
    <div className="flex h-[calc(100vh-52px-41px-24px-64px)] flex-col">
      {/* Minimal top nav */}
      <div className="flex items-center gap-2 px-1 pb-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={12} />
          Back
        </Button>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/all/inbox")}
        >
          Inbox
          <ArrowRight size={12} />
        </Button>
      </div>

      {/* Message thread */}
      <ScrollArea viewportRef={scrollRef} className="flex-1">
        <div className="mx-auto max-w-[680px] px-2 py-4">
          {messages.isLoading && (
            // Message-shaped skeletons: a user bubble right, a reply left.
            <div className="flex flex-col gap-7 py-4">
              <div className="flex justify-end">
                <Skeleton className="h-12 w-3/5 rounded-2xl rounded-br-md" />
              </div>
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 flex-none rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-11/12" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              </div>
            </div>
          )}

          {isEmpty && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <MisirAvatar />
              <p className="text-[13.5px] text-fg-muted">
                Ask Misir anything about this space.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-7">
            {(messages.data ?? []).map((m) => (
              <Message key={m.id} msg={m} />
            ))}
            {/* Optimistic bubble for the message being sent — the persisted list
                doesn't include it until the post-stream refetch. Skipped once
                the refetched tail already contains it (no double bubble). */}
            {stream.pendingUserMessage != null &&
              !(messages.data ?? [])
                .slice(-2)
                .some((m) => m.role === "user" && m.content === stream.pendingUserMessage) && (
                <div className="flex justify-end">
                  <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-bg-muted px-4 py-3 font-sans text-[14px] leading-[1.65] text-fg">
                    {stream.pendingUserMessage}
                  </div>
                </div>
              )}
            {stream.isStreaming && (
              <StreamingMessage partial={stream.partial} />
            )}
          </div>

          {stream.error && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--bg))] px-4 py-3 text-[13px] text-[var(--color-danger)]">
              <span className="min-w-0 flex-1">{stream.error}</span>
              {lastSent && (
                <span className="flex flex-none items-center gap-2">
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-md border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)]"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={restoreDraft}
                    className="rounded-md px-2 py-1 text-[12px] text-fg-muted transition-colors hover:text-fg"
                  >
                    Edit message
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Bottom padding so last message isn't flush against input */}
          <div className="h-4" />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="px-2 pb-2 pt-1">
        <div className="mx-auto max-w-[680px]">
          <div className="relative rounded-2xl border border-border-strong bg-bg-muted shadow-sm transition-colors focus-within:border-[color-mix(in_srgb,var(--color-ring)_60%,transparent)] focus-within:bg-bg">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              placeholder="Ask Misir…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              className="block w-full resize-none bg-transparent px-4 py-3.5 pr-14 font-sans text-[14px] text-fg placeholder:text-fg-subtle outline-none"
              style={{ maxHeight: 200 }}
            />
            <button
              onClick={submit}
              disabled={!draft.trim() || stream.isStreaming}
              aria-label="Send"
              className="absolute bottom-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-full bg-accent text-white transition-opacity hover:opacity-90 disabled:opacity-25"
            >
              <ArrowUp size={14} strokeWidth={2.5} />
            </button>
          </div>
          <p className="mt-1.5 text-center font-mono text-[10.5px] text-fg-faint">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}

function MisirAvatar({ pulsing = false }: { pulsing?: boolean }) {
  return (
    <div
      className={[
        "grid h-8 w-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]",
        pulsing ? "animate-pulse" : "",
      ].join(" ")}
    >
      <span className="font-display text-[15px] font-medium text-accent">M</span>
    </div>
  )
}

function MisirMarkdown({ content }: { content: string }) {
  return (
    <Markdown
      components={{
        p: ({ children }) => (
          <p className="mb-3 leading-[1.7] last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-[1.65]">{children}</li>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 transition-colors hover:text-accent-hover"
          >
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-fg">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        pre: ({ children }) => (
          <pre className="my-3 overflow-x-auto rounded-xl bg-[color-mix(in_srgb,var(--fg)_6%,var(--bg))] px-4 py-3">
            {children}
          </pre>
        ),
        code: ({ className, children }) => {
          if (className) {
            return (
              <code className="font-mono text-[12.5px] leading-[1.65] text-fg">
                {children}
              </code>
            )
          }
          return (
            <code className="rounded-md bg-[color-mix(in_srgb,var(--fg)_8%,var(--bg))] px-1.5 py-0.5 font-mono text-[12.5px]">
              {children}
            </code>
          )
        },
        h1: ({ children }) => (
          <h1 className="mb-3 mt-6 font-display text-[20px] font-medium text-fg first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-5 font-display text-[17px] font-medium text-fg first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-4 font-sans text-[15px] font-semibold text-fg first:mt-0">
            {children}
          </h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-[color-mix(in_srgb,var(--accent)_50%,transparent)] pl-4 italic text-fg-muted">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </Markdown>
  )
}

function Message({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-bg-muted px-4 py-3 font-sans text-[14px] leading-[1.65] text-fg">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-none">
        <MisirAvatar />
      </div>
      <div className="min-w-0 flex-1 font-serif text-[14px] text-fg">
        <MisirMarkdown content={msg.content} />
      </div>
    </div>
  )
}

function StreamingMessage({ partial }: { partial: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-none">
        <MisirAvatar pulsing={!partial} />
      </div>
      <div className="min-w-0 flex-1 font-serif text-[14px] text-fg">
        {partial ? (
          <>
            <MisirMarkdown content={partial} />
            <span
              className="ml-0.5 inline-block h-[15px] w-[2px] translate-y-[3px] rounded-full bg-fg-muted"
              style={{ animation: "pulse-dot 1s ease-in-out infinite" }}
            />
          </>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-fg-muted">
            <TypingDots />
            <span>Thinking…</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-[5px] w-[5px] rounded-full bg-fg-muted"
          style={{
            animation: "typing-bounce 1.4s infinite ease-in-out both",
            animationDelay: `${(i - 2) * 0.16}s`,
          }}
        />
      ))}
    </span>
  )
}
