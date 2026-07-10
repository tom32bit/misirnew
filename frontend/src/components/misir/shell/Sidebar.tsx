"use client"

import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useUser, useClerk } from "@clerk/nextjs"
import { toast } from "sonner"
import { Icon } from "@/components/misir/primitives/Icon"
import { useSpaces, useDeleteSpace } from "@/lib/hooks/useSpaces"
import { useUIStore } from "@/lib/stores/ui-store"
import { useTheme } from "@/lib/hooks/useTheme"
import { useUnreadCounts } from "@/lib/hooks/useUnreadCounts"
import { getSpaceColor } from "@/lib/constants/space-colors"
import type { Space } from "@/lib/api/types"

const VIEWS = [
  { id: "home", label: "Home", icon: "home", countKey: null },
  { id: "inbox", label: "Inbox", icon: "inbox", countKey: "inboxUnread" },
  {
    id: "notification",
    label: "Notification",
    icon: "bell",
    countKey: "notifCritical",
  },
  { id: "collection", label: "Collection", icon: "library", countKey: null },
  { id: "comparison", label: "Comparison", icon: "columns-3", countKey: null },
  { id: "decision", label: "Decision tree", icon: "git-branch", countKey: null },
] as const

export function Sidebar({ initialSpaces }: { initialSpaces: Space[] }) {
  const { data: spaces = initialSpaces } = useSpaces()
  const params = useParams<{ scope?: string; view?: string }>()
  const router = useRouter()
  const scope = params?.scope ?? "all"
  const view = params?.view ?? "home"

  const mobileOpen = useUIStore((s) => s.mobileMenuOpen)
  const setMobileOpen = useUIStore((s) => s.setMobileMenuOpen)
  const openModal = useUIStore((s) => s.openModal)
  const [theme, toggleTheme] = useTheme()
  const counts = useUnreadCounts()
  const { user } = useUser()
  const { signOut, openUserProfile } = useClerk()
  const deleteSpace = useDeleteSpace()
  const initial = user?.firstName?.[0] ?? user?.username?.[0] ?? "M"
  const displayName =
    user?.fullName ?? user?.firstName ?? user?.username ?? "Member"

  const closeDrawer = () => setMobileOpen(false)

  const handleSearch = () => {
    toast.message("⌘K is coming soon", {
      description: "Command palette search will be available shortly.",
    })
  }

  const handleDeleteSpace = (s: Space) => {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return
    deleteSpace.mutate(s.id, {
      onSuccess: () => {
        toast.success(`"${s.name}" deleted`, {
          description: "All associated data has been removed.",
        })
        if (String(scope) === String(s.id)) {
          router.push(`/dashboard/all/${view}`)
        }
      },
      onError: () => toast.error("Delete failed", {
        description: "Try again or reload the page.",
      }),
    })
  }

  const handleLogout = () => {
    signOut({ redirectUrl: "/sign-in" })
  }

  return (
    <aside
      className={[
        "flex h-screen w-[252px] flex-none flex-col overflow-hidden border-r border-border bg-bg-subtle",
        "mobile:fixed mobile:top-0 mobile:bottom-0 mobile:z-[300] mobile:w-[280px] mobile:transition-[left] mobile:duration-[240ms] mobile:ease-out",
        mobileOpen
          ? "mobile:left-0 mobile:shadow-[4px_0_32px_rgba(0,0,0,0.24)]"
          : "mobile:-left-full",
      ].join(" ")}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3.5">
        <Image src="/misir-logo.png" width={22} height={22} alt="Misir" />
        <span className="font-display text-[18px] font-semibold tracking-tight text-fg">
          Misir
        </span>
      </div>

      {/* Search */}
      <button
        type="button"
        className="mx-3 mb-2 flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-bg px-2.5 text-left text-[12.5px] text-fg-muted transition-colors hover:border-fg-faint hover:text-fg"
        onClick={handleSearch}
      >
        <Icon name="search" size={13} />
        <span>Search what you know…</span>
        <span className="ml-auto rounded-[5px] border border-border bg-bg-subtle px-1.5 py-0.5 font-sans text-[10px] text-fg-muted">
          ⌘K
        </span>
      </button>

      {/* Nav items */}
      <nav className="flex flex-col px-2">
        {VIEWS.map((v) => {
          const href = `/dashboard/all/${v.id}`
          const active = scope === "all" && view === v.id
          const count =
            v.countKey === "inboxUnread"
              ? counts.inboxUnread
              : v.countKey === "notifCritical"
                ? counts.notifCritical
                : 0
          return (
            <Link
              key={v.id}
              href={href}
              onClick={closeDrawer}
              className={[
                "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors",
                active
                  ? "bg-[var(--bg-active)] font-medium text-fg"
                  : "text-fg-muted hover:bg-[var(--bg-hover)] hover:text-fg",
              ].join(" ")}
            >
              <span
                className={
                  active ? "inline-flex text-accent" : "inline-flex text-fg-subtle"
                }
              >
                <Icon name={v.icon} size={14} />
              </span>
              <span className="flex-1">{v.label}</span>
              {count > 0 && (
                <span className="font-sans text-[10.5px] tabular-nums text-accent">
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Spaces label */}
      <div className="flex items-center gap-1 px-3.5 pt-3.5 pb-1 font-sans text-[10.5px] font-medium uppercase tracking-[0.12em] text-fg-subtle">
        <Icon name="chevron-down" size={11} />
        Spaces
        <button
          type="button"
          aria-label="New space"
          onClick={() => openModal({ kind: "new-space" })}
          className="ml-auto inline-flex p-0.5 text-fg-subtle hover:text-fg"
        >
          <Icon name="plus" size={12} />
        </button>
      </div>

      {/* Spaces list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {spaces.map((s) => {
          const color = getSpaceColor(s)
          const active = String(scope) === String(s.id)
          return (
            <div key={s.id} className="group/space-row flex items-center gap-0.5 pr-1">
              <Link
                href={`/dashboard/${s.id}/overview`}
                onClick={closeDrawer}
                className={[
                  "flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors",
                  active
                    ? "bg-[var(--bg-active)] font-medium text-fg"
                    : "text-fg-muted hover:bg-[var(--bg-hover)] hover:text-fg",
                ].join(" ")}
              >
                <span className="inline-flex shrink-0" style={{ color }}>
                  <Icon name="target" size={14} />
                </span>
                <span className="truncate font-serif">{s.name}</span>
              </Link>
              <button
                type="button"
                aria-label={`Edit ${s.name}`}
                onClick={() => openModal({ kind: "edit-space", spaceId: s.id })}
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-subtle opacity-0 transition-opacity hover:bg-bg-muted hover:text-fg group-hover/space-row:opacity-100"
              >
                <Icon name="pencil" size={11} />
              </button>
              <button
                type="button"
                aria-label={`Delete ${s.name}`}
                onClick={() => handleDeleteSpace(s)}
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-subtle opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover/space-row:opacity-100"
              >
                <Icon name="trash-2" size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Profile strip */}
      <div className="flex items-center gap-2.5 border-t border-border px-3.5 py-3">
        <button
          type="button"
          aria-label="Account settings"
          onClick={() => openUserProfile()}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-0 text-left hover:opacity-80 transition-opacity"
        >
          {user?.hasImage ? (
            <Image
              src={user.imageUrl}
              alt={displayName}
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-gray-700)] font-display text-[12px] font-semibold text-white">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="truncate text-[12.5px] font-medium leading-tight text-fg">
              {displayName}
            </div>
            <div className="truncate text-[11px] leading-tight text-fg-muted">
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </div>
          </div>
        </button>
        <button
          type="button"
          aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
          onClick={toggleTheme}
          className="grid h-7 w-7 place-items-center rounded-sm text-fg-subtle hover:bg-[var(--bg-hover)] hover:text-fg"
        >
          <Icon name={theme === "dark" ? "moon" : "sun"} size={14} />
        </button>
        <button
          type="button"
          aria-label="Log out"
          onClick={handleLogout}
          className="grid h-7 w-7 place-items-center rounded-sm text-fg-subtle hover:bg-[var(--bg-hover)] hover:text-danger"
        >
          <Icon name="log-out" size={14} />
        </button>
      </div>
    </aside>
  )
}
