"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, SectionHead } from "@/components/misir/primitives/Card"
import { useMessages, useSendMessageStream } from "@/lib/hooks/useChat"
import type { ChatMessage } from "@/lib/api/types"

export function ChatThread({ conversationId }: { conversationId: number }) {
  const router = useRouter()
  const search = useSearchParams()
  const messages = useMessages(conversationId)
  const stream = useSendMessageStream(conversationId)

  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentInitial = useRef(false)

  // Auto-send if NewChatModal handed us a `?send=` query.
  useEffect(() => {
    if (sentInitial.current) return
    const initial = search.get("send")
    if (initial && messages.isFetched && (messages.data?.length ?? 0) === 0) {
      sentInitial.current = true
      void stream.send(initial)
      router.replace(`/dashboard/chat/${conversationId}`)
    }
  }, [search, messages.isFetched, messages.data, stream, conversationId, router])

  // Auto-scroll to bottom on new messages / streaming.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.data, stream.partial, stream.isStreaming])

  const submit = () => {
    if (!draft.trim() || stream.isStreaming) return
    const content = draft.trim()
    setDraft("")
    void stream.send(content)
  }

  return (
    <div className="flex h-full max-h-[calc(100vh-52px-48px)] flex-col gap-3">
      <SectionHead
        title="Chat"
        small={`Conversation #${conversationId}`}
        right={
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft size={12} />
            Back
          </Button>
        }
      />

      <ScrollArea
        viewportRef={scrollRef}
        className="flex-1 rounded-lg border border-border bg-bg"
      >
        <div className="p-4">
          {messages.isLoading && (
            <div className="py-8 text-center text-[13px] text-fg-subtle">
              Loading messages…
            </div>
          )}
          {!messages.isLoading &&
            (messages.data?.length ?? 0) === 0 &&
            !stream.isStreaming && (
              <div className="py-8 text-center text-[13px] text-fg-subtle">
                No messages yet. Ask Misir anything below.
              </div>
            )}

          <div className="flex flex-col gap-4">
            {(messages.data ?? []).map((m) => (
              <Bubble key={m.id} msg={m} />
            ))}
            {stream.isStreaming && <StreamingBubble partial={stream.partial} />}
          </div>

          {stream.error && (
            <div className="mt-3 rounded-md border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--bg))] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">
              {stream.error}
            </div>
          )}
        </div>
      </ScrollArea>

      <Card className="rounded-lg border-border-strong">
        <Textarea
          rows={2}
          value={draft}
          placeholder="Ask Misir…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submit()
            }
          }}
          className="rounded-b-none border-0 px-3.5 py-2.5 text-[14px] shadow-none focus:shadow-none"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border px-3.5 py-2">
          <span className="text-[11.5px] text-fg-subtle">⌘ Enter to send</span>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={!draft.trim() || stream.isStreaming}
          >
            {stream.isStreaming ? "Sending…" : "Send"}
            <ArrowRight size={12} />
          </Button>
        </div>
      </Card>
    </div>
  )
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user"
  return (
    <div
      className={[
        "flex max-w-[80%] flex-col gap-1",
        isUser ? "self-end items-end" : "self-start items-start",
      ].join(" ")}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
        {isUser ? "You" : "Misir"}
      </span>
      <div
        className={[
          "rounded-lg px-3.5 py-2.5 text-[13.5px] leading-[1.55]",
          isUser
            ? "bg-bg-muted text-fg"
            : "bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg))] border border-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-fg",
        ].join(" ")}
      >
        {msg.content}
      </div>
    </div>
  )
}

function StreamingBubble({ partial }: { partial: string }) {
  return (
    <div className="flex max-w-[80%] flex-col items-start gap-1 self-start">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
        Misir
      </span>
      <div className="rounded-lg border border-[color-mix(in_srgb,var(--accent)_15%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg))] px-3.5 py-2.5 text-[13.5px] leading-[1.55] text-fg">
        {partial || (
          <span className="inline-flex items-center gap-1.5">
            <TypingDots />
            <span className="text-fg-muted">Misir is thinking…</span>
          </span>
        )}
        {partial && (
          <span
            className="ml-1 inline-block h-3 w-px translate-y-[1px] bg-accent"
            style={{ animation: "pulse-dot 1s ease-in-out infinite" }}
          />
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
          className="block h-[5px] w-[5px] rounded-full bg-accent"
          style={{
            animation: "typing-bounce 1.4s infinite ease-in-out both",
            animationDelay: `${(i - 2) * 0.16}s`,
          }}
        />
      ))}
    </span>
  )
}
