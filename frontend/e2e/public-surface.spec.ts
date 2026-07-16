/**
 * The signed-out surface: the only thing a visitor sees before they sign up.
 *
 * Every assertion here corresponds to a bug that actually shipped and was found
 * by hand, not by CI. Keep that bar: this file is for things a real browser must
 * observe (layout, playback, the network), not for logic a unit test can reach.
 */
import { expect, test, type Page, type Response } from "@playwright/test"

/**
 * Same-origin responses only. The suite runs with a fake Clerk publishable key
 * pointing at example.clerk.accounts.dev, so Clerk's script legitimately fails
 * to load; asserting on every request would flag that and drown the real signal.
 */
function watchOwnAssets(page: Page) {
  const bad: string[] = []
  page.on("response", (res: Response) => {
    const url = new URL(res.url())
    const isOwn = url.host === new URL(page.url() || "http://127.0.0.1").host
    if (!isOwn) return
    // Documents legitimately redirect (/dashboard → /sign-in). Sub-resources
    // never should: a redirected image or video silently renders nothing.
    if (res.request().resourceType() === "document") return
    if (res.status() >= 300) bad.push(`${res.status()} ${res.request().resourceType()} ${url.pathname}`)
  })
  return bad
}

test.describe("landing", () => {
  test("is a tall, scrollable document", async ({ page }) => {
    // Smoke check, not a guard for the specific `body { overflow: hidden }` bug
    // that shipped: that break needs the viewport-propagation behaviour of a
    // real browser and does NOT reproduce in headless Chromium (verified — the
    // document scrolls there even with html/body overflow forced hidden). What
    // this does catch is the landing collapsing to viewport height, or a
    // wrapper turning it into a non-scrolling fixed pane — either of which
    // leaves the content below the hero unreachable.
    await page.goto("/")
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    const viewport = await page.evaluate(() => window.innerHeight)
    expect(height, "landing collapsed to ~viewport height").toBeGreaterThan(viewport + 50)

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect
      .poll(() => page.evaluate(() => window.scrollY), {
        message: "landing did not scroll at all",
      })
      .toBeGreaterThan(0)
  })

  test("does not scroll sideways at desktop width", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/")
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflows, "horizontal scrollbar on the landing").toBe(false)
  })

  test("does not scroll sideways on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflows, "horizontal scrollbar at 390px").toBe(false)
  })

  test("serves every asset it asks for", async ({ page }) => {
    // Regression: proxy.ts's matcher exempts static files by extension. webm was
    // missing, so the video 307'd to /sign-in; .otf was missing, so the fonts
    // did too. A redirected sub-resource throws no error — it just never renders.
    const bad = watchOwnAssets(page)
    await page.goto("/", { waitUntil: "networkidle" })
    expect(bad, "assets returned a redirect/error instead of bytes").toEqual([])
  })

  test("plays the closing video", async ({ page }) => {
    await page.goto("/")
    const video = page.locator("video")
    await video.scrollIntoViewIfNeeded()

    // Autoplay needs muted + playsInline; a 307'd src leaves readyState at 0.
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), {
        message: "video never buffered — check the src resolves and is not redirected",
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(3)

    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), {
        message: "video buffered but never advanced — autoplay blocked?",
        timeout: 10_000,
      })
      .toBeGreaterThan(0)

    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false)
    expect(
      await video.evaluate((v: HTMLVideoElement) => v.videoWidth),
      "no frames decoded",
    ).toBeGreaterThan(0)
  })

  test("renders its own fonts rather than falling back", async ({ page }) => {
    // The .otf faces 307'd for weeks, so the body copy silently rendered in the
    // Georgia fallback. document.fonts is the only place that shows up.
    await page.goto("/", { waitUntil: "networkidle" })
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready
      return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family)
    })
    expect(loaded.length, "no webfonts loaded at all").toBeGreaterThan(0)
  })
})

test.describe("auth entry points", () => {
  test("Sign in reaches the sign-in route", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: /^sign in$/i }).first().click()
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test("the beta CTA reaches the sign-up route", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: /beta/i }).first().click()
    await expect(page).toHaveURL(/\/sign-up/)
  })

  test("the dashboard is not reachable signed out", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/sign-in/)
  })
})

test.describe("legal pages", () => {
  test("privacy policy renders and scrolls", async ({ page }) => {
    // /privacy was collateral damage of the same overflow rule.
    await page.goto("/privacy")
    await expect(page.getByRole("heading", { name: /privacy policy/i })).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  })

  test("do-not-sell is its own reachable page", async ({ page }) => {
    await page.goto("/privacy/do-not-sell")
    await expect(
      page.getByRole("heading", { name: /do not sell or share/i }),
    ).toBeVisible()
  })

  test("the landing links to both", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: /privacy policy/i }).first()).toHaveAttribute(
      "href",
      "/privacy",
    )
    await expect(page.getByRole("link", { name: /do not sell/i }).first()).toHaveAttribute(
      "href",
      "/privacy/do-not-sell",
    )
  })
})

test.describe("icons", () => {
  test("every icon and the manifest resolve", async ({ page, request }) => {
    await page.goto("/")
    const links = await page
      .locator('link[rel*="icon"], link[rel="manifest"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""))

    expect(links.length, "no icon/manifest links in <head>").toBeGreaterThan(0)
    for (const href of links) {
      const res = await request.get(href)
      expect(res.status(), `${href} did not resolve`).toBe(200)
    }
  })

  test("the manifest is branded, not the generator's placeholder", async ({ request }) => {
    // It shipped as "MyWebSite"/"MySite" — the name a browser shows on install.
    const res = await request.get("/site.webmanifest")
    expect(res.status()).toBe(200)
    const manifest = await res.json()
    expect(manifest.name).toBe("Misir")
    expect(manifest.short_name).toBe("Misir")
  })
})
