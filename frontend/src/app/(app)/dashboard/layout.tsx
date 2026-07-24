import type { Metadata } from "next"
import { serverApi } from "@/lib/api/server"
import { spacesApi } from "@/lib/api/spaces"
import type { Space } from "@/lib/api/types"
import { DashboardShell } from "@/components/misir/shell/DashboardShell"

// Dashboard is auth-gated and reads search params client-side; never prerender.
export const dynamic = "force-dynamic"
// Private, per-user data — never indexable, and it would otherwise inherit
// the landing's OG card since no page under here sets its own metadata.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side fetch so the sidebar paints with real data on first load.
  // Failure (e.g. backend down, JWT expired) falls back to an empty list;
  // the client sidebar will retry via useSpaces().
  let spaces: Space[] = []
  try {
    const k = await serverApi()
    spaces = await spacesApi.list(k)
  } catch {
    spaces = []
  }

  return <DashboardShell initialSpaces={spaces}>{children}</DashboardShell>
}
