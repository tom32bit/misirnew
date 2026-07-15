"use client"

import ky from "ky"
import { useAuth } from "@clerk/nextjs"
import { useMemo } from "react"
import { API_URL } from "@/lib/env"

const BASE = API_URL

/**
 * Client-side ky instance. Calls `getToken()` from Clerk on every request
 * and attaches `Authorization: Bearer <jwt>`.
 *
 * Use this inside `'use client'` components or via the query hooks in
 * `src/lib/hooks/*` which expect a ky instance.
 */
export function useApi() {
  const { getToken } = useAuth()

  return useMemo(
    () =>
      ky.create({
        prefixUrl: BASE,
        timeout: 30_000,
        retry: { limit: 1, methods: ["get"], statusCodes: [502, 503, 504] },
        hooks: {
          beforeRequest: [
            async (request) => {
              const token = await getToken()
              if (token) request.headers.set("Authorization", `Bearer ${token}`)
            },
          ],
        },
      }),
    [getToken],
  )
}
