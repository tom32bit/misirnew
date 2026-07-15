import ky from "ky"
import { auth } from "@clerk/nextjs/server"
import { API_URL } from "@/lib/env"

/**
 * Server-side ky for use inside RSC, server actions, and route handlers.
 * Pulls the current request's Clerk JWT and attaches it.
 */
export async function serverApi() {
  const { getToken } = await auth()
  const token = await getToken()

  return ky.create({
    prefixUrl: API_URL,
    timeout: 30_000,
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}
