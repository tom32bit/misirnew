import { redirect } from "next/navigation"
import { serverApi } from "@/lib/api/server"
import { spacesApi } from "@/lib/api/spaces"
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow"

export const dynamic = "force-dynamic"

export default async function OnboardingPage() {
  // If the user already has at least one space, skip onboarding.
  try {
    const k = await serverApi()
    const spaces = await spacesApi.list(k)
    if (spaces.length > 0) redirect(`/dashboard/${spaces[0].id}/home`)
  } catch {
    // Backend unreachable — let the user attempt onboarding anyway; the
    // generate call inside SetupOverlay will surface a real error.
  }

  return <OnboardingFlow />
}
