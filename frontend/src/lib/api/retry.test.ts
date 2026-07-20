import { describe, expect, it } from "vitest"
import { REQUEST_TIMEOUT_MS, RETRY_POLICY } from "./retry"

/**
 * These constants exist to survive a Render free-tier cold start (30–50s).
 * Each assertion below is a bug that actually shipped, so the numbers are
 * pinned rather than left to taste.
 */
describe("transport policy", () => {
  it("outlasts a cold start", () => {
    // Was 30_000 — the request aborted mid-boot, so the app failed even though
    // the backend came up a few seconds later.
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000)
  })

  it("retries reads more than once", () => {
    // One retry could not cover a 50s boot inside the old timeout.
    expect(RETRY_POLICY.limit).toBeGreaterThanOrEqual(3)
  })

  it("never retries mutations", () => {
    // A POST that times out may have been applied; replaying it double-writes.
    expect([...RETRY_POLICY.methods]).toEqual(["get"])
  })

  it("covers the status codes a waking container returns", () => {
    for (const code of [502, 503, 504]) {
      expect([...RETRY_POLICY.statusCodes]).toContain(code)
    }
  })

  it("caps the backoff so a retry cannot stall past the timeout", () => {
    expect(RETRY_POLICY.backoffLimit).toBeLessThan(REQUEST_TIMEOUT_MS)
  })
})
