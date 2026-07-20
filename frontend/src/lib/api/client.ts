"use client"

import ky from "ky"
import { useAuth } from "@clerk/nextjs"
import { useMemo } from "react"
import { API_URL } from "@/lib/env"
import { REQUEST_TIMEOUT_MS, RETRY_POLICY } from "./retry"

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
        timeout: REQUEST_TIMEOUT_MS,
        retry: RETRY_POLICY,
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
