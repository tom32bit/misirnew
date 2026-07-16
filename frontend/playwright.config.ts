import { defineConfig, devices } from "@playwright/test"

/**
 * Browser smoke tests for the signed-out surface.
 *
 * These exist because the unit suite structurally cannot see the bugs that
 * actually shipped here: `body { overflow: hidden }` made the landing
 * unscrollable, and a missing extension in proxy.ts's matcher had the closing
 * video (and later every .otf font) 307 to /sign-in. Both need a real browser —
 * one needs layout, the other needs the network. Both were found by a human.
 *
 * Runs against `next start`, not `next dev`: the production bundle is what
 * ships, and dev's error overlay can mask a broken page.
 */

const PORT = 3210
const BASE_URL = `http://127.0.0.1:${PORT}`

/**
 * Fake Clerk keys, so the suite needs no secrets and no Clerk account.
 *
 * Clerk will not boot without keys at all — every route 500s with "Missing
 * secretKey" — but it never calls Clerk's API to render a signed-out public
 * page, so syntactically valid fakes are enough. /dashboard then fails closed
 * and redirects to /sign-in, which is the behaviour we want to assert anyway.
 *
 * These must be `_live_` keys, not `_test_`. A pk_test key marks a Clerk
 * DEVELOPMENT instance, which runs a handshake against Clerk's API on browser
 * navigation and dies with "Handshake token verification failed" on a fake
 * secret. curl never triggers that path (no cookies, no dev-browser token) —
 * only a real browser does, which is exactly what this suite is.
 *
 * The publishable key is `pk_live_` + base64("clerk.example.com$"), the shape
 * Clerk parses its frontend host out of. The secret is never sent anywhere —
 * no public route calls Clerk's API — so its value is arbitrary; the hyphens
 * are deliberate, so GitHub secret scanning does not mistake `sk_live_` + an
 * unbroken alphanumeric run for a real Stripe key and block the push.
 */
const CLERK_ENV = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuZXhhbXBsZS5jb20k",
  CLERK_SECRET_KEY: "sk_live_ci-smoke-fake-not-a-real-secret-do-not-scan",
  NEXT_PUBLIC_API_URL: "http://localhost:8000/api/v1",
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Builds as well as serves, deliberately. NEXT_PUBLIC_* vars are inlined
    // into the client bundle at BUILD time, so ClerkProvider would otherwise
    // ship whatever key .env.local happened to hold while the server ran on the
    // fake one — client and server disagreeing about the instance. Building here
    // with the same env keeps the run hermetic and identical on a laptop and in
    // CI, at the cost of one extra build.
    command: `npx next build && npx next start -p ${PORT}`,
    url: BASE_URL,
    // Never reuse a running dev server: it serves the dev bundle with the real
    // .env.local, so a pass would say nothing about what actually ships.
    reuseExistingServer: false,
    timeout: 180_000,
    env: CLERK_ENV,
  },
})
