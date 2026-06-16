import { redirect } from "next/navigation"
import { serverApi } from "@/lib/api/server"
import { spacesApi } from "@/lib/api/spaces"

export default async function DashboardIndex() {
  let spaces = [] as Awaited<ReturnType<typeof spacesApi.list>>
  try {
    const k = await serverApi()
    spaces = await spacesApi.list(k)
  } catch {
    // If the backend is unreachable we still send the user to onboarding —
    // they can't do anything without a space anyway.
    redirect("/onboarding")
  }

  if (spaces.length === 0) redirect("/onboarding")
  redirect(`/dashboard/${spaces[0].id}/overview`)
}
