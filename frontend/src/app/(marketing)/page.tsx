import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { Landing } from "@/components/landing/Landing"

/**
 * Signed in  → the dashboard.
 * Signed out → the landing page (its CTAs route to /sign-in and /sign-up).
 */
export default async function RootPage() {
  const { userId } = await auth()
  if (userId) redirect("/dashboard")
  return <Landing />
}
