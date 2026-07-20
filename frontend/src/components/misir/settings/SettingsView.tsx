"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useClerk } from "@clerk/nextjs"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import { CalendarIcon, Trash2, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useApi } from "@/lib/api/client"
import { privacyApi, type ConsentRow } from "@/lib/api/privacy"
import { useSpace, useUpdateSpace, useDeleteSpace } from "@/lib/hooks/useSpaces"
import { useDeadline, useUpsertDeadline, useRemoveDeadline } from "@/lib/hooks/useDeadline"

type Scope = "all" | number

export function SettingsView({ scope }: { scope: Scope }) {
  // Account-level settings (privacy, data export, delete account) belong to the
  // account, not to any one space — so they live only in the all-spaces settings
  // (/dashboard/all/settings). A specific space's settings shows only that
  // space's settings; deleting your whole account from inside "Space X" was a
  // placement bug.
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      {scope === "all" ? <AccountPrivacySection /> : <SpaceSettings spaceId={scope} />}
    </div>
  )
}

// Claude-style toggle switch — replaces the raw browser checkbox.
function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
        "disabled:cursor-default disabled:opacity-50",
        checked ? "bg-[var(--color-accent)]" : "bg-[var(--border-strong)]",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-[left] duration-150",
          checked ? "left-[19px]" : "left-[3px]",
        )}
      />
    </button>
  )
}

const CAPTURE_PURPOSES = [
  { key: "web_capture", label: "Web page capture", desc: "Save readable text from pages matching your spaces." },
  { key: "ai_chat_capture", label: "AI chat capture", desc: "Save your conversations from supported AI sites." },
] as const

function AccountPrivacySection() {
  const api = useApi()
  const { signOut } = useClerk()

  const [granted, setGranted] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let active = true
    privacyApi
      .getConsent(api)
      .then((res) => {
        if (!active) return
        const map: Record<string, boolean> = {}
        for (const c of res.consents) map[c.purpose] = c.granted
        setGranted(map)
      })
      .catch(() => {/* unauthenticated/offline — leave defaults */})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [api])

  const gpc = () => {
    const nav = navigator as unknown as { globalPrivacyControl?: boolean }
    return nav.globalPrivacyControl === true
  }

  const toggle = async (purpose: string, value: boolean) => {
    const next = { ...granted, [purpose]: value }
    setGranted(next)
    const consents: ConsentRow[] = CAPTURE_PURPOSES.map((p) => ({
      purpose: p.key,
      granted: !!next[p.key],
    }))
    try {
      await privacyApi.putConsent(api, consents, undefined, gpc())
      toast.success(value ? "Consent granted" : "Consent withdrawn")
    } catch {
      setGranted(granted) // revert
      toast.error("Couldn't update consent", { description: "Try again in a moment." })
    }
  }

  const exportData = async () => {
    setBusy(true)
    try {
      const data = await privacyApi.exportData(api)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "misir-data-export.json"
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Export downloaded")
    } catch {
      toast.error("Export failed", { description: "Try again in a moment." })
    } finally {
      setBusy(false)
    }
  }

  const deleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    try {
      await privacyApi.deleteAccount(api)
      toast.success("Account deleted")
      await signOut({ redirectUrl: "/" })
    } catch {
      setBusy(false)
      toast.error("Deletion failed", { description: "Try again or contact support." })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Section label="Privacy & consent">
        {CAPTURE_PURPOSES.map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13.5px] font-medium text-fg">{p.label}</div>
              <div className="mt-0.5 text-[12px] leading-[1.5] text-fg-muted">{p.desc}</div>
            </div>
            <Toggle
              label={p.label}
              checked={!!granted[p.key]}
              disabled={loading}
              onChange={(v) => void toggle(p.key, v)}
            />
          </div>
        ))}
        <div className="text-[11.5px] leading-[1.4] text-fg-subtle">
          Capture is off until you turn it on, and the browser&apos;s Global Privacy Control signal
          is honored.{" "}
          <Link href="/privacy" className="text-accent underline">Privacy Policy</Link>
          {" · "}
          <Link href="/privacy/do-not-sell" className="text-accent underline">Do Not Sell/Share</Link>
        </div>
      </Section>

      <Section label="Your data">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[13.5px] font-medium text-fg">Export my data</div>
            <div className="mt-0.5 text-[12px] leading-[1.5] text-fg-muted">
              Download a machine-readable copy of your account data (portability).
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportData} disabled={busy} className="shrink-0 gap-1.5">
            <Download size={12} /> Export
          </Button>
        </div>
      </Section>

      <Section label="Danger zone" danger>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[13.5px] font-medium text-fg">Delete my account</div>
            <div className="mt-0.5 text-[12px] leading-[1.5] text-fg-muted">
              {confirmDelete
                ? "This permanently erases your account and ALL data. This cannot be undone."
                : "Permanently erase your account and all associated data (right to erasure)."}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {confirmDelete && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={deleteAccount}
              disabled={busy}
              className={
                confirmDelete
                  ? "border-[var(--color-danger)] bg-[var(--color-danger)] text-white hover:opacity-90"
                  : "border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_6%,transparent)]"
              }
            >
              <Trash2 size={12} />
              {busy ? "Working…" : confirmDelete ? "Yes, delete everything" : "Delete account"}
            </Button>
          </div>
        </div>
      </Section>
    </div>
  )
}

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-sans text-[10.5px] font-medium uppercase tracking-[0.1em] text-fg-subtle">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[11.5px] leading-[1.4] text-fg-subtle">{hint}</span>
      )}
    </div>
  )
}

function Section({
  label,
  danger,
  children,
}: {
  label: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={[
        "rounded-panel border bg-bg-subtle",
        danger
          ? "border-[color-mix(in_srgb,var(--color-danger)_30%,var(--border))]"
          : "border-border",
      ].join(" ")}
    >
      <div
        className={[
          "px-5 py-3.5 font-sans text-[10.5px] font-medium uppercase tracking-[0.12em]",
          danger ? "text-[var(--color-danger)]" : "text-fg-subtle",
        ].join(" ")}
      >
        {label}
      </div>
      <div className="h-px bg-border" />
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
    </div>
  )
}

function SpaceSettings({ spaceId }: { spaceId: number }) {
  const router = useRouter()
  const space = useSpace(spaceId)
  const deadline = useDeadline(spaceId)
  const updateSpace = useUpdateSpace()
  const deleteSpace = useDeleteSpace()
  const upsertDeadline = useUpsertDeadline(spaceId)
  const removeDeadline = useRemoveDeadline(spaceId)

  const [name, setName] = useState("")
  const [goal, setGoal] = useState("")
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [calOpen, setCalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!space.data) return
    setName(space.data.name ?? "")
    setGoal(space.data.goal ?? "")
  }, [space.data])

  useEffect(() => {
    if (deadline.isLoading) return
    if (deadline.data?.due_at) {
      setDueDate(parseISO(deadline.data.due_at))
    } else {
      setDueDate(undefined)
    }
  }, [deadline.data, deadline.isLoading])

  const generalDirty =
    !!space.data &&
    (name.trim() !== (space.data.name ?? "") ||
      goal.trim() !== (space.data.goal ?? ""))

  // Compare as epoch ms, not strings — the stored due_at's ISO format
  // (offset style, ms precision) differs from Date#toISOString output, so a
  // string comparison misreports dirty for identical instants.
  const storedDueMs = deadline.data?.due_at ? Date.parse(deadline.data.due_at) : null
  const draftDueMs = dueDate ? dueDate.getTime() : null
  const deadlineDirty = !deadline.isLoading && draftDueMs !== storedDueMs

  const saveGeneral = async () => {
    if (!name.trim()) return
    try {
      await updateSpace.mutateAsync({
        id: spaceId,
        body: { name: name.trim(), goal: goal.trim() || undefined },
      })
      toast.success("Changes saved")
    } catch {
      toast.error("Save failed", { description: "Check your connection and try again." })
    }
  }

  const saveDeadline = async () => {
    if (!dueDate) return
    try {
      await upsertDeadline.mutateAsync({
        label: name.trim() || space.data?.name || "Target",
        due_at: dueDate.toISOString(),
        target_pct: 80,
      })
      toast.success("Deadline updated")
    } catch {
      toast.error("Couldn't save deadline", { description: "Try again in a moment." })
    }
  }

  const handleRemoveDeadline = async () => {
    try {
      await removeDeadline.mutateAsync()
      setDueDate(undefined)
      toast.success("Deadline removed")
    } catch {
      toast.error("Couldn't remove deadline", { description: "Try again in a moment." })
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    try {
      await deleteSpace.mutateAsync(spaceId)
      router.push("/dashboard")
    } catch {
      toast.error("Delete failed", { description: "Try again or reload the page." })
    }
  }

  if (space.isLoading) {
    return (
      <div className="py-12 text-center text-[13px] text-fg-subtle">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* General */}
      <Section label="General">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Challenge name"
            className="h-9 text-[13.5px]"
          />
        </Field>

        <Field
          label="Goal"
          hint="Specific beats ambitious. Misir uses this to measure readiness."
        >
          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            placeholder="Describe what done looks like."
          />
        </Field>

        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={saveGeneral}
            disabled={!generalDirty || !name.trim() || updateSpace.isPending}
          >
            {updateSpace.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Section>

      {/* Deadline */}
      <Section label="Deadline">
        <Field
          label="Target date"
          hint={!deadline.isLoading && !dueDate ? "Pick a date and click Save deadline to set one." : undefined}
        >
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={[
                  "flex h-9 w-full items-center justify-between rounded-md border px-3 text-[13.5px] transition-[border-color,background-color] focus:outline-none",
                  dueDate
                    ? "border-border-strong bg-bg text-fg hover:border-accent"
                    : "border-dashed border-border-strong bg-bg-subtle text-fg-muted hover:border-accent hover:text-fg",
                ].join(" ")}
              >
                <span>
                  {deadline.isLoading
                    ? "Loading…"
                    : dueDate
                      ? format(dueDate, "d MMM yyyy")
                      : "Click to set a deadline"}
                </span>
                <CalendarIcon size={14} className="shrink-0 text-fg-muted" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={(d) => {
                  setDueDate(d)
                  setCalOpen(false)
                }}
                disabled={(d) => d < TODAY}
              />
            </PopoverContent>
          </Popover>
        </Field>

        <div className="flex items-center justify-between gap-3">
          {deadline.data ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveDeadline}
              disabled={removeDeadline.isPending}
              className="text-fg-muted hover:text-[var(--color-danger)]"
            >
              {removeDeadline.isPending ? "Removing…" : "Remove deadline"}
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={saveDeadline}
            disabled={!dueDate || !deadlineDirty || upsertDeadline.isPending}
          >
            {upsertDeadline.isPending ? "Saving…" : "Save deadline"}
          </Button>
        </div>
      </Section>

      {/* Danger zone */}
      <Section label="Danger zone" danger>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[13.5px] font-medium text-fg">
              Delete this space
            </div>
            <div className="mt-0.5 text-[12px] leading-[1.5] text-fg-muted">
              {confirmDelete
                ? "This cannot be undone. All subspaces, markers, and captures will be lost."
                : "Permanently removes this space and all its data."}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {confirmDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleDelete}
              disabled={deleteSpace.isPending}
              className={
                confirmDelete
                  ? "border-[var(--color-danger)] bg-[var(--color-danger)] text-white hover:opacity-90"
                  : "border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_6%,transparent)]"
              }
            >
              <Trash2 size={12} />
              {deleteSpace.isPending
                ? "Deleting…"
                : confirmDelete
                  ? "Yes, delete"
                  : "Delete space"}
            </Button>
          </div>
        </div>
      </Section>
    </div>
  )
}
