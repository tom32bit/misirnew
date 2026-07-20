import type { RetryOptions } from "ky"

/**
 * Shared transport policy for both ky instances.
 *
 * The backend runs on a free Render instance that spins down after ~15 minutes
 * of inactivity; the next request pays a 30–50s cold start while the container
 * boots. A cron keeps it warm in the common case, but the first request after
 * any gap — a deploy, a missed cron run, a platform restart — still pays it.
 *
 * Two things have to be true for that request to survive:
 *
 *   1. The timeout must outlast the boot. 30s aborted mid-wake, so the app
 *      failed even though the backend came up seconds later.
 *   2. Retries must cover the way a cold start actually fails. ky's default
 *      `statusCodes` only retries HTTP responses; a boot produces a timeout or
 *      a dropped connection — no response at all — so a status-based policy
 *      never fires on the one case it was meant to catch.
 */

/** Long enough for a Render free-tier cold start (30–50s) plus headroom. */
export const REQUEST_TIMEOUT_MS = 60_000

/**
 * GET-only retry. Mutations are excluded: a POST that times out may well have
 * been applied server-side, and replaying it would double-write.
 *
 * `502/503/504` are Render's responses while a container is coming up;
 * `408/429` are transient by definition. Network-level failures (timeout,
 * connection reset) are not status codes — ky retries those whenever `limit`
 * allows, which is exactly the cold-start case.
 */
export const RETRY_POLICY: Required<
  Pick<RetryOptions, "limit" | "methods" | "statusCodes" | "backoffLimit">
> = {
  limit: 3,
  methods: ["get"],
  statusCodes: [408, 429, 500, 502, 503, 504],
  backoffLimit: 8_000,
}
