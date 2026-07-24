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

  // Don't decide onboarding-vs-dashboard from this server read. It resolves the
  // Clerk session server-side, which can disagree with the client (token timing,
  // instance/key skew after a Clerk migration) and return an empty list for a
  // user who genuinely has spaces — trapping them in onboarding on every login.
  // Route to the home view and let the client, whose useSpaces() reflects what
  // the user actually sees, make the call (HomeAll redirects to /onboarding only
  // on a confirmed-empty client read). `spaces` still warms the layout's sidebar.
  void spaces
  redirect("/dashboard/all/home")
}
