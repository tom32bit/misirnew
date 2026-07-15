"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { AnimatePresence, motion } from "motion/react"
import { Icon } from "@/components/misir/primitives/Icon"
import { ModalShell, ModalHead, ModalBody } from "@/components/misir/modals/ModalShell"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { useTheme } from "@/lib/hooks/useTheme"
import { useUIStore } from "@/lib/stores/ui-store"
import { getSpaceColor } from "@/lib/constants/space-colors"
import { DUR, SPRING } from "@/lib/motion"

const VIEWS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "inbox", label: "Inbox", icon: "inbox" },
  { id: "notification", label: "Notifications", icon: "bell" },
  { id: "collection", label: "Collection", icon: "library" },
  { id: "comparison", label: "Comparison", icon: "columns-3" },
  { id: "decision", label: "Decision tree", icon: "git-branch" },
] as const

const ITEM_CLASS = [
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-fg-muted",
  "data-[selected=true]:bg-bg-muted data-[selected=true]:text-fg",
].join(" ")

const GROUP_CLASS =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:text-fg-subtle"

/** ⌘K palette: jump to views and spaces, run common actions. */
export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { data: spaces = [] } = useSpaces()
  const openModal = useUIStore((s) => s.openModal)
  const [theme, toggleTheme] = useTheme()

  // Esc closes (cmdk itself only handles list navigation).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (typeof document === "undefined") return null

  const go = (href: string) => {
    onClose()
    router.push(href)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cmd-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast }}
            onClick={onClose}
            className="fixed inset-0 z-[400] bg-[rgba(20,18,16,0.45)] backdrop-blur-[2px]"
          />
          <div className="pointer-events-none fixed inset-0 z-[401] flex justify-center pt-[16vh] mobile:pt-[10vh]">
            <motion.div
              key="cmd-panel"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: 8,
                scale: 0.98,
                transition: { duration: DUR.fast },
              }}
              transition={SPRING.smooth}
              className="pointer-events-auto h-fit w-[560px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-border-strong bg-bg shadow-pop"
            >
              <Command label="Command palette">
                <div className="flex items-center gap-2.5 border-b border-border px-4">
                  <Icon name="search" size={14} className="flex-none text-fg-subtle" />
                  <Command.Input
                    autoFocus
                    placeholder="Search views, spaces, actions…"
                    className="h-12 w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-faint"
                  />
                  <kbd className="flex-none rounded-[5px] border border-border bg-bg-subtle px-1.5 py-0.5 font-sans text-[10px] text-fg-muted">
                    esc
                  </kbd>
                </div>

                <Command.List className="max-h-[340px] overflow-y-auto p-2">
                  <Command.Empty className="px-3 py-8 text-center text-[13px] text-fg-subtle">
                    Nothing matches.
                  </Command.Empty>

                  <Command.Group heading="Go to" className={GROUP_CLASS}>
                    {VIEWS.map((v) => (
                      <Command.Item
                        key={v.id}
                        value={`go ${v.label}`}
                        onSelect={() => go(`/dashboard/all/${v.id}`)}
                        className={ITEM_CLASS}
                      >
                        <Icon name={v.icon} size={14} className="flex-none text-fg-subtle" />
                        {v.label}
                      </Command.Item>
                    ))}
                  </Command.Group>

                  {spaces.length > 0 && (
                    <Command.Group heading="Spaces" className={GROUP_CLASS}>
                      {spaces.map((s) => (
                        <Command.Item
                          key={s.id}
                          value={`space ${s.name}`}
                          onSelect={() => go(`/dashboard/${s.id}/overview`)}
                          className={ITEM_CLASS}
                        >
                          <Icon
                            name="target"
                            size={14}
                            className="flex-none"
                            style={{ color: getSpaceColor(s) }}
                          />
                          <span className="truncate">{s.name}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  <Command.Group heading="Actions" className={GROUP_CLASS}>
                    <Command.Item
                      value="new space create"
                      onSelect={() => {
                        onClose()
                        openModal({ kind: "new-space" })
                      }}
                      className={ITEM_CLASS}
                    >
                      <Icon name="plus" size={14} className="flex-none text-fg-subtle" />
                      New space
                    </Command.Item>
                    <Command.Item
                      value="new chat ask misir"
                      onSelect={() => {
                        onClose()
                        openModal({ kind: "new-chat" })
                      }}
                      className={ITEM_CLASS}
                    >
                      <Icon name="message-circle" size={14} className="flex-none text-fg-subtle" />
                      New chat
                    </Command.Item>
                    <Command.Item
                      value="toggle theme dark light"
                      onSelect={() => {
                        onClose()
                        toggleTheme()
                      }}
                      className={ITEM_CLASS}
                    >
                      <Icon
                        name={theme === "dark" ? "sun" : "moon"}
                        size={14}
                        className="flex-none text-fg-subtle"
                      />
                      Switch to {theme === "dark" ? "light" : "dark"} theme
                    </Command.Item>
                    <Command.Item
                      value="keyboard shortcuts help"
                      onSelect={() => {
                        onClose()
                        openModal({ kind: "shortcuts" })
                      }}
                      className={ITEM_CLASS}
                    >
                      <Icon name="keyboard" size={14} className="flex-none text-fg-subtle" />
                      Keyboard shortcuts
                    </Command.Item>
                  </Command.Group>
                </Command.List>
              </Command>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["⌘", "K"], label: "Command palette" },
  { keys: ["G", "H"], label: "Go to Home" },
  { keys: ["G", "I"], label: "Go to Inbox" },
  { keys: ["G", "N"], label: "Go to Notifications" },
  { keys: ["G", "C"], label: "Go to Collection" },
  { keys: ["G", "M"], label: "Go to Comparison" },
  { keys: ["G", "D"], label: "Go to Decision tree" },
  { keys: ["N"], label: "New space" },
  { keys: ["T"], label: "Toggle theme" },
  { keys: ["?"], label: "This panel" },
]

/** The `?` help sheet listing every global shortcut. */
export function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Keyboard shortcuts">
      <ModalHead
        eyebrow="Keyboard"
        title="Shortcuts"
        sub="Sequences like G H mean: press G, then H."
        onClose={onClose}
      />
      <ModalBody>
        <div className="flex flex-col">
          {SHORTCUTS.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0"
            >
              <span className="text-[13px] text-fg-muted">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="grid h-6 min-w-6 place-items-center rounded-[5px] border border-border bg-bg-subtle px-1.5 font-sans text-[11px] text-fg"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </ModalBody>
    </ModalShell>
  )
}
