import Link from "next/link"
import { redirect } from "next/navigation"
import { serverApi } from "@/lib/api/server"
import { spacesApi } from "@/lib/api/spaces"

export default async function DashboardIndex() {
  // Fetch spaces outside the redirect calls — next/navigation's redirect()
  // signals via an internal throw, so wrapping it in try-catch intercepts the
  // redirect itself. Keep the fetch isolated in try-catch; redirect outside.
  let spaces: Awaited<ReturnType<typeof spacesApi.list>> | null = null
  try {
    const k = await serverApi()
    spaces = await spacesApi.list(k)
  } catch {
    // Backend unreachable — render a stable error rather than redirecting to
    // /onboarding, which would cause /dashboard ↔ /onboarding ping-pong.
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[15px] font-medium text-fg">Backend unavailable</p>
        <p className="max-w-sm text-[13px] text-fg-muted">
          Misir can&apos;t reach its API right now. Start the backend server, then refresh.
        </p>
        <Link
          href="/dashboard"
          className="mt-2 rounded-lg border border-border-strong bg-bg px-4 py-2 text-[13px] text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
        >
          Retry
        </Link>
      </div>
    )
  }

  if (spaces.length === 0) redirect("/onboarding")
  redirect(`/dashboard/${spaces[0].id}/overview`)
}
