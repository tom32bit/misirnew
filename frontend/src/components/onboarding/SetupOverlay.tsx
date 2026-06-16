"use client"

import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useGenerateSpace } from "@/lib/hooks/useSpaces"
import { useApi } from "@/lib/api/client"
import { deadlinesApi } from "@/lib/api/deadlines"
import type { OnboardingDraft } from "./OnboardingFlow"

const STEPS = [
  { width: "40%", label: "Generating subspaces" },
  { width: "72%", label: "Building marker set" },
  { width: "91%", label: "Calibrating readiness baseline" },
  { width: "100%", label: "Ready" },
] as const

export function SetupOverlay({
  draft,
  withExt,
}: {
  draft: OnboardingDraft
  withExt: boolean
}) {
  const router = useRouter()
  const generate = useGenerateSpace()
  const k = useApi()
  const [tick, setTick] = useState(0)
  const startedRef = useRef(false)

  // Fire the space generation once on mount. Deadline is saved in the same
  // Promise chain so it completes even if the user navigates away before the
  // API returns (Promise callbacks are not tied to component lifecycle).
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    try {
      localStorage.setItem("misir.onboarded", "true")
      localStorage.setItem(
        "misir.firstSpace",
        JSON.stringify({
          title: draft.challenge,
          goal: draft.goal,
          deadline: draft.deadline?.toISOString() ?? null,
          extInstalled: withExt,
          onboardedAt: Date.now(),
        }),
      )
    } catch {
      // ignore
    }

    generate
      .mutateAsync({
        name: draft.challenge.trim(),
        intention: draft.goal.trim() || undefined,
      })
      .then((space) => {
        if (!draft.deadline) return
        return deadlinesApi
          .upsert(k, space.id, {
            label: draft.challenge.trim(),
            due_at: draft.deadline.toISOString(),
            target_pct: 80,
          })
          .catch((err) =>
            console.error("Deadline save failed — can be set from Space Settings:", err),
          )
      })
      .catch((err) => {
        toast.error("Space setup failed", {
          description: err instanceof Error ? err.message : "Backend didn't respond.",
        })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drive the visual progress steps independently of the API.
  useEffect(() => {
    const delay = tick === 0 ? 200 : tick === STEPS.length ? 700 : 520
    const id = setTimeout(() => {
      setTick((t) => Math.min(t + 1, STEPS.length))
    }, delay)
    return () => clearTimeout(id)
  }, [tick])

  const animDone = tick >= STEPS.length

  const displayName =
    draft.challenge.length > 40
      ? `${draft.challenge.slice(0, 40)}…`
      : draft.challenge
  const stepIdx = Math.max(0, tick - 1)
  const fill = tick === 0 ? "0%" : STEPS[Math.min(stepIdx, STEPS.length - 1)].width
  const subLabel =
    generate.isError
      ? "Something went wrong — try again."
      : STEPS[Math.min(stepIdx, STEPS.length - 1)].label

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-[18px] bg-[var(--bg)]"
    >
      <div className="text-center font-display text-[22px] font-semibold tracking-tight text-fg [text-wrap:pretty]">
        &ldquo;Setting up {displayName}&rdquo;
      </div>
      <div className="h-[2px] w-[200px] overflow-hidden rounded-[2px] bg-border-strong">
        <div
          className="h-full rounded-[2px] bg-accent"
          style={{
            width: fill,
            transition: "width 1.6s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
      <div className="font-mono text-[13.5px] tracking-wide text-fg-muted">
        {subLabel}
      </div>
      {animDone && !generate.isError && (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          type="button"
          onClick={() => router.replace("/dashboard")}
          className="mt-2 rounded-md bg-accent px-5 py-2 text-[13.5px] font-medium text-fg-on-accent hover:bg-accent-hover"
        >
          Take me home
        </motion.button>
      )}
    </motion.div>
  )
}
